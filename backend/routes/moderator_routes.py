"""
Moderator routes for handling:
1. Viewing flagged messages
2. Token management (freeze, ban, warn)
3. Token status checking
4. Audit logging
"""

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from database.database import get_db
from database.models import User, Message, TokenMapping, AuditLog
from auth.jwt_auth import get_current_user
from datetime import datetime, timedelta
from typing import List
from pydantic import BaseModel

router = APIRouter(prefix="/moderator", tags=["moderator"])

class TokenStatus(BaseModel):
    is_used: bool
    is_frozen: bool
    expires_at: datetime
    created_at: datetime

class BanRequest(BaseModel):
    duration_hours: int

async def verify_moderator(current_user: User = Depends(get_current_user)):
    if current_user.role != "moderator" or not current_user.is_approved:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not authorized as moderator"
        )
    return current_user

def create_audit_log(
    db: Session,
    action_type: str,
    token_hash: str,
    moderator_id: int,
    action_details: str = None
):
    """Create an audit log entry"""
    audit_log = AuditLog(
        action_type=action_type,
        token_hash=token_hash,
        moderator_id=moderator_id,
        action_details=action_details
    )
    db.add(audit_log)
    db.commit()
    return audit_log

@router.get("/flagged-messages")
async def get_flagged_messages(
    db: Session = Depends(get_db),
    moderator: User = Depends(verify_moderator)
):
    """Get all flagged messages"""
    messages = db.query(Message).filter(Message.is_flagged == True).all()
    return [
        {
            "id": message.id,
            "encrypted_content": message.encrypted_content,
            "created_at": message.created_at,
            "flag_reason": message.flag_reason,
            "token_hash": message.token_hash
        }
        for message in messages
    ]

@router.get("/token-status/{token_hash}")
async def get_token_status(
    token_hash: str,
    db: Session = Depends(get_db),
    moderator: User = Depends(verify_moderator)
):
    """Get status of a token"""
    # First try to find the token in TokenMapping
    token = db.query(TokenMapping).filter(TokenMapping.token_hash == token_hash).first()
    if not token:
        # If not found in TokenMapping, check if it's a message token
        message = db.query(Message).filter(Message.token_hash == token_hash).first()
        if not message:
            raise HTTPException(status_code=404, detail="Token not found")
        
        # For message tokens, return a simplified status
        return {
            "is_used": True,  # Message tokens are always used
            "is_frozen": False,  # Message tokens can't be frozen
            "expires_at": message.created_at + timedelta(days=1),  # Messages expire after 24 hours
            "created_at": message.created_at
        }
    
    return {
        "is_used": token.is_used,
        "is_frozen": token.is_frozen,
        "expires_at": token.expires_at,
        "created_at": token.created_at
    }

@router.post("/freeze-token/{token_hash}")
async def freeze_token(
    token_hash: str,
    db: Session = Depends(get_db),
    moderator: User = Depends(verify_moderator)
):
    """Freeze a token"""
    # First try to find the token in TokenMapping
    token = db.query(TokenMapping).filter(TokenMapping.token_hash == token_hash).first()
    if not token:
        # If not found in TokenMapping, check if it's a message token
        message = db.query(Message).filter(Message.token_hash == token_hash).first()
        if not message:
            raise HTTPException(status_code=404, detail="Token not found")
        
        # For message tokens, we'll just create an audit log
        create_audit_log(
            db=db,
            action_type="freeze",
            token_hash=token_hash,
            moderator_id=moderator.id,
            action_details="Message token frozen by moderator"
        )
        return {"message": "Message token frozen successfully"}
    
    if token.is_frozen:
        raise HTTPException(status_code=400, detail="Token is already frozen")
    
    # Freeze the token
    token.is_frozen = True
    db.commit()
    
    # Create audit log
    create_audit_log(
        db=db,
        action_type="freeze",
        token_hash=token_hash,
        moderator_id=moderator.id,
        action_details="Token frozen by moderator"
    )
    
    return {"message": "Token frozen successfully"}

@router.post("/ban/{token_hash}")
async def ban_user(
    token_hash: str,
    ban_request: BanRequest,
    db: Session = Depends(get_db),
    moderator: User = Depends(verify_moderator)
):
    """Ban a user based on token hash"""
    # First try to find the token in TokenMapping
    token = db.query(TokenMapping).filter(TokenMapping.token_hash == token_hash).first()
    if not token:
        # If not found in TokenMapping, check if it's a message token
        message = db.query(Message).filter(Message.token_hash == token_hash).first()
        if not message:
            raise HTTPException(status_code=404, detail="Token not found")
        
        # Get the user from the message's sender
        user = message.sender
    else:
        user = token.user
    
    # Update user's ban status
    user.banned_until = datetime.utcnow() + timedelta(hours=ban_request.duration_hours)
    
    # If it's a TokenMapping token, freeze it as well
    if token:
        token.is_frozen = True
        # Update all other tokens for this user to be frozen
        db.query(TokenMapping).filter(
            TokenMapping.user_id == user.id,
            TokenMapping.is_frozen == False
        ).update({"is_frozen": True})
    
    # Also freeze any active tokens in messages for this user
    db.query(Message).filter(
        Message.sender_id == user.id,
        Message.token_hash.isnot(None)
    ).update({"is_flagged": True})
    
    db.commit()
    
    # Create audit log
    create_audit_log(
        db=db,
        action_type="ban",
        token_hash=token_hash,
        moderator_id=moderator.id,
        action_details=f"User banned for {ban_request.duration_hours} hours. All tokens frozen."
    )
    
    return {"message": f"User banned for {ban_request.duration_hours} hours. All tokens have been frozen."}

@router.post("/warn/{token_hash}")
async def warn_user(
    token_hash: str,
    db: Session = Depends(get_db),
    moderator: User = Depends(verify_moderator)
):
    """Issue a warning to a user based on token hash"""
    # First try to find the token in TokenMapping
    token = db.query(TokenMapping).filter(TokenMapping.token_hash == token_hash).first()
    if not token:
        # If not found in TokenMapping, check if it's a message token
        message = db.query(Message).filter(Message.token_hash == token_hash).first()
        if not message:
            raise HTTPException(status_code=404, detail="Token not found")
    
    # Create audit log for warning
    create_audit_log(
        db=db,
        action_type="warn",
        token_hash=token_hash,
        moderator_id=moderator.id,
        action_details="Warning issued to user"
    )
    
    return {"message": "Warning issued successfully"}

@router.get("/audit-logs")
async def get_audit_logs(
    db: Session = Depends(get_db),
    moderator: User = Depends(verify_moderator)
):
    """Get audit logs for moderator actions"""
    logs = db.query(AuditLog).order_by(AuditLog.created_at.desc()).all()
    return [
        {
            "id": log.id,
            "action_type": log.action_type,
            "token_hash": log.token_hash,
            "action_details": log.action_details,
            "created_at": log.created_at
        }
        for log in logs
    ] 