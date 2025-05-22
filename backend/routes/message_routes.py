"""
Message handling routes for WhisperChain+.

This file contains endpoints for:
1. Sending encrypted messages
2. Receiving messages
3. Message flagging
4. Message deletion
5. Message history
"""

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List, Optional
from pydantic import BaseModel
from database.database import get_db
from database.models import User, Message, TokenMapping, AuditLog
from encryption.message_crypto import encrypt_message, decrypt_message
from auth.jwt_auth import get_current_user
from encryption.key_management import KeyManager
import datetime

router = APIRouter(prefix="/messages", tags=["messages"])

class MessageCreate(BaseModel):
    recipient_id: int
    encrypted_content: str
    token_hash: str  # Add token hash field

class MessageResponse(BaseModel):
    id: int
    sender_name: str
    encrypted_content: str
    created_at: str
    read: bool

class DecryptRequest(BaseModel):
    encrypted_message: str
    key_password: str
    private_key: Optional[str] = None  # Add optional private key field

class FlagMessageRequest(BaseModel):
    reason: str

@router.post("/send")
async def send_message(
    message: MessageCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    # Verify user is approved and is a sender
    if not current_user.is_approved or current_user.role != "sender":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not authorized to send messages"
        )
    
    # Get recipient
    recipient = db.query(User).filter(User.id == message.recipient_id).first()
    if not recipient:
        raise HTTPException(status_code=404, detail="Recipient not found")
    
    # Verify recipient is approved
    if not recipient.is_approved:
        raise HTTPException(status_code=400, detail="Recipient is not approved")
    
    # Check if the token is currently banned
    current_time = datetime.datetime.utcnow()
    active_ban = db.query(AuditLog).filter(
        AuditLog.token_hash == message.token_hash,
        AuditLog.action_type == "ban",
        AuditLog.created_at >= current_time - datetime.timedelta(minutes=5)  # Check last 5 minutes
    ).first()
    
    if active_ban:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="This token has been banned for 5 minutes and cannot be used to send messages"
        )
    
    # Create message
    db_message = Message(
        encrypted_content=message.encrypted_content,
        sender_id=current_user.id,
        recipient_id=message.recipient_id,
        token_hash=message.token_hash  # Add token hash to message
    )
    
    db.add(db_message)
    db.commit()
    db.refresh(db_message)
    
    return {
        "id": db_message.id,
        "created_at": db_message.created_at
    }

@router.get("/inbox", response_model=List[MessageResponse])
async def get_inbox(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    # Check if user is approved
    if not current_user.is_approved or current_user.status != "approved":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Your account is not approved to receive messages"
        )
    
    # Check if user is a receiver
    if current_user.role != "receiver":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only users with 'receiver' role can access inbox"
        )
    
    # Get all messages for the user
    messages = db.query(Message).filter(Message.recipient_id == current_user.id).all()
    
    # Format messages for response
    message_responses = []
    for msg in messages:
        sender = db.query(User).filter(User.id == msg.sender_id).first()
        message_responses.append(
            MessageResponse(
                id=msg.id,
                sender_name=sender.username if sender else "Unknown",
                encrypted_content=msg.encrypted_content,  # Frontend will decrypt this
                created_at=msg.created_at.isoformat(),
                read=msg.read or False
            )
        )
    
    # Return the list directly
    return message_responses

@router.get("/{message_id}/mark-read")
async def mark_message_read(
    message_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    # Find the message
    message = db.query(Message).filter(
        Message.id == message_id,
        Message.recipient_id == current_user.id
    ).first()
    
    if not message:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Message not found"
        )
    
    # Mark as read
    message.read = True
    db.commit()
    
    return {"status": "success"}

@router.post("/decrypt")
async def decrypt_message_content(
    decrypt_request: DecryptRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    try:
        # If private key is provided by the frontend
        if decrypt_request.private_key:
            try:
                # Load the private key
                from cryptography.hazmat.primitives import serialization
                private_key = serialization.load_pem_private_key(
                    decrypt_request.private_key.encode('utf-8'),
                    password=None
                )
                
                # Decrypt the message
                decrypted_message = decrypt_message(
                    decrypt_request.encrypted_message,
                    private_key
                )
                
                return {"decrypted_message": decrypted_message}
            except Exception as e:
                print(f"Error decrypting with provided key: {str(e)}")
                # Fall back to returning the message as-is
                return {"decrypted_message": decrypt_request.encrypted_message}
        else:
            # For now, we're bypassing decryption and just returning the message as is
            # This is because we may be storing plain text for now
            return {"decrypted_message": decrypt_request.encrypted_message}
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Failed to process message: {str(e)}"
        )

@router.post("/{message_id}/flag")
async def flag_message(
    message_id: int,
    flag_request: FlagMessageRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    # Verify user is approved and is a receiver
    if not current_user.is_approved or current_user.role != "receiver":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not authorized to flag messages"
        )
    
    # Get message
    message = db.query(Message).filter(Message.id == message_id).first()
    if not message:
        raise HTTPException(status_code=404, detail="Message not found")
    
    # Verify message belongs to current user
    if message.recipient_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not authorized to flag this message")
    
    # Flag the message
    message.is_flagged = True
    message.flag_reason = flag_request.reason
    
    db.commit()
    
    return {"status": "message flagged successfully"}

@router.get("/current-round")
async def get_current_round(
    current_user: User = Depends(get_current_user)
):
    """Get the current round ID based on the current time"""
    # Each round lasts 24 hours
    # Round ID is calculated as the number of days since epoch
    current_time = datetime.datetime.utcnow()
    epoch = datetime.datetime(1970, 1, 1)
    days_since_epoch = (current_time - epoch).days
    return {"round_id": days_since_epoch}

@router.get("/flagged")
async def get_flagged_messages(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get all flagged messages (moderator only)"""
    if current_user.role != "moderator":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only moderators can view flagged messages"
        )
    
    flagged_messages = db.query(Message).filter(
        Message.is_flagged == True
    ).order_by(Message.created_at.desc()).all()  # Order by newest first
    
    return [
        {
            "id": msg.id,
            "sender_name": msg.sender.username,
            "encrypted_content": msg.encrypted_content,
            "created_at": msg.created_at,
            "token_hash": msg.token_hash
        }
        for msg in flagged_messages
    ] 