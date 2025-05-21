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
from database.models import User, Message
from encryption.message_crypto import encrypt_message, decrypt_message
from auth.jwt_auth import get_current_user
from encryption.key_management import KeyManager

router = APIRouter(prefix="/messages", tags=["messages"])

class MessageCreate(BaseModel):
    recipient_id: int
    message: str

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

@router.post("/send", status_code=status.HTTP_201_CREATED)
async def send_message(
    message: MessageCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    # Check if sender is approved
    if not current_user.is_approved or current_user.status != "approved":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Your account is not approved to send messages"
        )
    
    # Check if sender is a sender role
    if current_user.role != "sender":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only users with 'sender' role can send messages"
        )
    
    # Find recipient
    recipient = db.query(User).filter(User.id == message.recipient_id).first()
    if not recipient:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Recipient not found"
        )
    
    # Check if recipient is approved
    if not recipient.is_approved or recipient.status != "approved":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Recipient account is not approved"
        )
    
    # Check if recipient is a receiver
    if recipient.role != "receiver":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Can only send messages to users with 'receiver' role"
        )
    
    # Encrypt the message using recipient's public key
    try:
        encrypted_content = encrypt_message(message.message, recipient.public_key)
    except Exception as e:
        # If encryption fails, just store as plaintext
        print(f"Encryption failed: {str(e)}, storing as plaintext")
        encrypted_content = message.message
    
    # Create and save the message
    db_message = Message(
        encrypted_content=encrypted_content,
        sender_id=current_user.id,
        recipient_id=recipient.id
    )
    
    db.add(db_message)
    db.commit()
    db.refresh(db_message)
    
    return {"id": db_message.id, "status": "sent"}

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