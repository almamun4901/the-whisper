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
from typing import List
from pydantic import BaseModel
from database.database import get_db
from database.models import User, Message
from encryption.message_crypto import encrypt_message, decrypt_message
from auth.jwt_auth import get_current_user

router = APIRouter(prefix="/messages", tags=["messages"])

class MessageCreate(BaseModel):
    recipient_username: str
    content: str

class MessageResponse(BaseModel):
    id: int
    sender_username: str
    content: str
    created_at: str
    read: bool

class DecryptRequest(BaseModel):
    encrypted_content: str
    private_key: str

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
    recipient = db.query(User).filter(User.username == message.recipient_username).first()
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
    encrypted_content = encrypt_message(message.content, recipient.public_key)
    
    # Create and save the message
    db_message = Message(
        content=encrypted_content,
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
        message_responses.append({
            "id": msg.id,
            "sender_username": sender.username,
            "content": msg.content,  # Frontend will decrypt this
            "created_at": msg.created_at.isoformat(),
            "read": msg.read
        })
    
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
async def decrypt_message_content(decrypt_request: DecryptRequest):
    try:
        decrypted_content = decrypt_message(
            decrypt_request.encrypted_content,
            decrypt_request.private_key
        )
        return {"decrypted_content": decrypted_content}
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Failed to decrypt message: {str(e)}"
        ) 