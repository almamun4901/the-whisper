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
from database.models import User, Message, TokenMapping, AuditLog, UserBan
from encryption.message_crypto import encrypt_message, decrypt_message
from auth.jwt_auth import get_current_user
from encryption.key_management import KeyManager
from encryption.token_manager import TokenManager
from datetime import datetime, timedelta

router = APIRouter(prefix="/messages", tags=["messages"])

def format_datetime(dt: Optional[datetime]) -> str:
    """Format datetime consistently across the application in 24-hour format"""
    if dt is None:
        return "permanently"
    return dt.strftime('%Y-%m-%d %H:%M:%S')

class MessageCreate(BaseModel):
    recipient_id: int
    encrypted_content: str
    token_hash: Optional[str] = None  # Make token_hash optional with a default of None

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

@router.get("/current-round")
async def get_current_round(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get the current round ID for token generation"""
    # Round changes every 2 minutes (120 seconds)
    current_round = int(datetime.now().timestamp() / 120)
    return {"round_id": current_round}

@router.post("/send")
async def send_message(
    message: MessageCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    token_manager: TokenManager = Depends(lambda: TokenManager(
        secret_key="your-secret-key",
        encryption_key="your-encryption-key-string"
    ))
):
    # Verify user is approved and is a sender
    if not current_user.is_approved or current_user.role != "sender":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only approved senders can send messages"
        )

    # Check for active bans
    current_time = datetime.now()
    print(f"Checking bans at current time: {current_time}")
    
    active_ban = db.query(UserBan).filter(
        UserBan.user_id == current_user.id,
        UserBan.is_active == True
    ).first()
    
    if active_ban:
        print(f"Found ban: end_time={active_ban.ban_end_time}, current_time={current_time}")
        # Check if ban has expired
        if active_ban.ban_end_time is not None and active_ban.ban_end_time <= current_time:
            print(f"Ban has expired, marking as inactive. Ban end time: {active_ban.ban_end_time}")
            active_ban.is_active = False
            db.commit()
            db.refresh(active_ban)  # Refresh to ensure changes are reflected
        else:
            print(f"Ban is still active. End time: {active_ban.ban_end_time}")
            # Ban is still active, format ban time and create user-friendly message
            ban_end_time = format_datetime(active_ban.ban_end_time)
            ban_type = active_ban.ban_reason.split(":")[0] if ":" in active_ban.ban_reason else "unknown"
            ban_reason = active_ban.ban_reason.split(":", 1)[1].strip() if ":" in active_ban.ban_reason else active_ban.ban_reason
            
            # Create user-friendly message based on ban type
            if ban_type == 'freeze':
                ban_message = "Your account has been permanently banned"
            elif ban_type == 'temp_5min':
                ban_message = f"You are temporarily banned for 5 minutes"
            elif ban_type == 'temp_1hour':
                ban_message = f"You are temporarily banned for 1 hour"
            else:
                ban_message = "You are currently banned"
            
            error_message = {
                "status": "banned",
                "ban_type": ban_type,
                "ban_end_time": ban_end_time,
                "ban_reason": ban_reason,
                "message": f"{ban_message}. You can send messages again after {ban_end_time}. Reason: {ban_reason}"
            }
            
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=error_message
            )
    
    # Check for token bans
    if message.token_hash:
        token_ban = db.query(UserBan).filter(
            UserBan.banned_token_hash == message.token_hash,
            UserBan.is_active == True
        ).first()
        
        if token_ban:
            print(f"Found token ban: end_time={token_ban.ban_end_time}, current_time={current_time}")
            # Check if token ban has expired
            if token_ban.ban_end_time is not None and token_ban.ban_end_time <= current_time:
                print(f"Token ban has expired, marking as inactive. Ban end time: {token_ban.ban_end_time}")
                token_ban.is_active = False
                db.commit()
                db.refresh(token_ban)  # Refresh to ensure changes are reflected
            else:
                print(f"Token ban is still active. End time: {token_ban.ban_end_time}")
                # Token ban is still active, format ban time and create user-friendly message
                ban_end_time = format_datetime(token_ban.ban_end_time)
                ban_type = token_ban.ban_reason.split(":")[0] if ":" in token_ban.ban_reason else "unknown"
                ban_reason = token_ban.ban_reason.split(":", 1)[1].strip() if ":" in token_ban.ban_reason else token_ban.ban_reason
                
                # Create user-friendly message based on ban type
                if ban_type == 'freeze':
                    ban_message = "This token has been permanently banned"
                elif ban_type == 'temp_5min':
                    ban_message = f"This token is temporarily banned for 5 minutes"
                elif ban_type == 'temp_1hour':
                    ban_message = f"This token is temporarily banned for 1 hour"
                else:
                    ban_message = "This token is currently banned"
                
                error_message = {
                    "status": "token_banned",
                    "ban_type": ban_type,
                    "ban_end_time": ban_end_time,
                    "ban_reason": ban_reason,
                    "message": f"{ban_message}. You can use this token again after {ban_end_time}. Reason: {ban_reason}"
                }
                
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail=error_message
                )
    
    # Check if token is frozen
    token = db.query(TokenMapping).filter(
        TokenMapping.token_hash == message.token_hash,
        TokenMapping.is_frozen == True
    ).first()
    
    if token:
        # Get the freeze time in a consistent format
        freeze_time = format_datetime(token.updated_at)
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail={
                "status": "token_frozen",
                "message": f"This token has been frozen by a moderator since {freeze_time}. Please use a different token to send messages."
            }
        )
    
    # Validate token
    is_valid, error_message = token_manager.validate_token_for_message(message.token_hash, current_user.id)
    if not is_valid:
        # If token is invalid, try to create a new one
        try:
            # Calculate current round ID (2 minutes)
            current_round = int(datetime.now().timestamp() / 120)
            
            token_hash, is_new = token_manager.get_or_create_token(current_user.id, current_round)
            message.token_hash = token_hash
            is_valid, error_message = token_manager.validate_token_for_message(token_hash, current_user.id)
            if not is_valid:
                # Create user-friendly error message
                if "already been used" in error_message:
                    error_message = "This token has already been used in this round. Please wait for the next round or use a different token."
                elif "not found" in error_message:
                    error_message = "Token not found. A new token will be created for you."
                elif "expired" in error_message:
                    error_message = "This token has expired. A new token will be created for you."
                
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail={"status": "token_invalid", "message": error_message}
                )
        except ValueError as e:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail={"status": "token_error", "message": str(e)}
            )
    
    # Create message
    db_message = Message(
        encrypted_content=message.encrypted_content,
        sender_id=current_user.id,
        recipient_id=message.recipient_id,
        token_hash=message.token_hash
    )
    
    db.add(db_message)
    db.commit()
    db.refresh(db_message)

    # Add audit log for message sending
    audit_log = AuditLog(
        action_type="message_sent",
        token_hash=message.token_hash,
        moderator_id=None,
        user_id=current_user.id,
        action_details=f"Message sent from user {current_user.id} to {message.recipient_id}"
    )
    db.add(audit_log)
    db.commit()
    
    # Record token usage for this message
    token_manager.record_message_token(db_message.id, message.token_hash)
    
    return {
        "id": db_message.id,
        "created_at": db_message.created_at,
        "token_hash": message.token_hash  # Return the token hash so frontend can store it
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

@router.get("/token-status/{token_hash}")
async def get_token_status(
    token_hash: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get the current status of a token"""
    current_time = datetime.now()
    
    # Check for token bans
    token_ban = db.query(UserBan).filter(
        UserBan.banned_token_hash == token_hash,
        UserBan.is_active == True
    ).first()
    
    if token_ban:
        # Check if ban has expired
        if token_ban.ban_end_time is not None and token_ban.ban_end_time <= current_time:
            # Ban has expired, mark as inactive
            token_ban.is_active = False
            db.commit()
            return {"status": "active"}
        else:
            # Ban is still active
            return {
                "status": "banned",
                "message": f"Token banned until {format_datetime(token_ban.ban_end_time)}. Reason: {token_ban.ban_reason}"
            }
    
    # Check if token is frozen
    token = db.query(TokenMapping).filter(
        TokenMapping.token_hash == token_hash,
        TokenMapping.is_frozen == True
    ).first()
    
    if token:
        return {
            "status": "frozen",
            "message": f"Token frozen since {format_datetime(token.updated_at)}"
        }
    
    # Token is active
    return {"status": "active"} 