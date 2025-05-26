"""
Moderator routes for handling:
1. Viewing flagged messages
2. Token management (freeze, ban, warn)
3. Token status checking
4. Audit logging
"""

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session, joinedload
from database.database import get_db
from database.models import User, Message, TokenMapping, AuditLog, UserBan
from auth.jwt_auth import get_current_user
from datetime import datetime, timedelta
from typing import List, Optional
from pydantic import BaseModel
from encryption.token_manager import TokenManager
import os

router = APIRouter(prefix="/moderator", tags=["moderator"])

def format_datetime(dt: Optional[datetime]) -> str:
    """Format datetime consistently across the application in 24-hour format"""
    if dt is None:
        return "permanently"
    return dt.strftime('%Y-%m-%d %H:%M:%S')

def get_token_manager():
    return TokenManager(
        secret_key="your-secret-key",
        encryption_key="your-encryption-key-string"
    )

class TokenStatus(BaseModel):
    is_used: bool
    is_frozen: bool
    expires_at: str  # Changed to string for consistent formatting
    created_at: str  # Changed to string for consistent formatting

class BanRequest(BaseModel):
    token_hash: str
    ban_type: str  # 'freeze', 'temp_5min', 'temp_1hour', or 'warning'
    ban_reason: str

class BanResponse(BaseModel):
    user_id: int
    username: str
    ban_end_time: datetime
    ban_reason: str
    banned_token_hash: str
    ban_type: str

async def verify_moderator(current_user: User = Depends(get_current_user)):
    """Verify that the current user is an approved moderator"""
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
    user_id: int = None,
    action_details: str = None
):
    """Create an audit log entry"""
    audit_log = AuditLog(
        action_type=action_type,
        token_hash=token_hash,
        moderator_id=moderator_id,
        user_id=user_id,
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
            "expires_at": format_datetime(message.created_at + timedelta(days=1)),  # Messages expire after 24 hours
            "created_at": format_datetime(message.created_at)
        }
    
    return {
        "is_used": token.is_used,
        "is_frozen": token.is_frozen,
        "expires_at": format_datetime(token.expires_at),
        "created_at": format_datetime(token.created_at)
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

@router.post("/unfreeze-token/{token_hash}")
async def unfreeze_token(
    token_hash: str,
    db: Session = Depends(get_db),
    moderator: User = Depends(verify_moderator)
):
    """Unfreeze a token"""
    token = db.query(TokenMapping).filter(TokenMapping.token_hash == token_hash).first()
    if not token:
        raise HTTPException(status_code=404, detail="Token not found")
    
    if not token.is_frozen:
        raise HTTPException(status_code=400, detail="Token is not frozen")
    
    # Unfreeze the token
    token.is_frozen = False
    token.updated_at = datetime.now()
    db.commit()
    
    # Create audit log
    create_audit_log(
        db=db,
        action_type="unfreeze",
        token_hash=token_hash,
        moderator_id=moderator.id,
        action_details="Token unfrozen by moderator"
    )
    
    return {"message": "Token unfrozen successfully"}

@router.post("/ban-user")
async def ban_user(
    ban_request: BanRequest,
    db: Session = Depends(get_db),
    moderator: User = Depends(verify_moderator),
    token_manager: TokenManager = Depends(lambda: TokenManager(
        secret_key="your-secret-key",
        encryption_key="your-encryption-key-string"
    ))
):
    # Find the user associated with this token
    token_mapping = db.query(TokenMapping).filter(TokenMapping.token_hash == ban_request.token_hash).first()
    if not token_mapping:
        # Try to find the token in messages
        message = db.query(Message).filter(Message.token_hash == ban_request.token_hash).first()
        if not message:
            raise HTTPException(status_code=404, detail="Token not found")
        user = db.query(User).filter(User.id == message.sender_id).first()
    else:
        user = db.query(User).filter(User.id == token_mapping.user_id).first()
    
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    # Load user with bans relationship
    user = db.query(User).options(joinedload(User.bans)).filter(User.id == user.id).first()
    
    # Check if user is already banned
    current_time = datetime.now()
    active_ban = next(
        (ban for ban in user.bans if ban.is_active and 
         (ban.ban_end_time is None or ban.ban_end_time > current_time)),
        None
    )
    
    if active_ban and ban_request.ban_type != 'warning':
        raise HTTPException(
            status_code=400,
            detail=f"User is already banned until {format_datetime(active_ban.ban_end_time)}"
        )

    try:
        # For warnings, just create an audit log
        if ban_request.ban_type == 'warning':
            audit_log = AuditLog(
                action_type="warning_issued",
                moderator_id=moderator.id,
                user_id=user.id,
                action_details=f"Warning issued: {ban_request.ban_reason}",
                token_hash=ban_request.token_hash
            )
            db.add(audit_log)
            db.commit()
            return {"status": "warning issued successfully"}

        # Calculate ban end time based on ban type
        ban_end_time = None
        if ban_request.ban_type == 'temp_5min':
            ban_end_time = current_time + timedelta(minutes=5)
        elif ban_request.ban_type == 'temp_1hour':
            ban_end_time = current_time + timedelta(hours=1)
        # 'freeze' type will have ban_end_time as None (permanent)

        # Create ban record with only the fields that exist in the model
        ban = UserBan(
            user_id=user.id,
            ban_reason=f"{ban_request.ban_type}: {ban_request.ban_reason}",
            ban_start_time=current_time,
            ban_end_time=ban_end_time,
            is_active=True,
            banned_token_hash=ban_request.token_hash
        )
        
        db.add(ban)
        
        # Update all user's tokens to frozen status
        user_tokens = db.query(TokenMapping).filter(
            TokenMapping.user_id == user.id,
            TokenMapping.is_frozen == False
        ).all()
        
        for token in user_tokens:
            token.is_frozen = True
            token.updated_at = current_time
        
        # Create audit log
        audit_log = AuditLog(
            action_type="user_banned",
            moderator_id=moderator.id,
            user_id=user.id,
            action_details=f"User banned ({ban_request.ban_type}): {ban_request.ban_reason}",
            token_hash=ban_request.token_hash
        )
        db.add(audit_log)
        
        db.commit()
        db.refresh(user)
        
        return {"status": "user banned successfully"}
        
    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=500,
            detail=f"Failed to ban user: {str(e)}"
        )

@router.get("/banned-users")
async def get_banned_users(
    db: Session = Depends(get_db),
    moderator: User = Depends(verify_moderator)
):
    """Get list of currently banned users"""
    current_time = datetime.now()
    active_bans = db.query(UserBan).filter(
        UserBan.is_active == True,
        UserBan.ban_end_time > current_time
    ).all()
    
    return [
        {
            "user_id": ban.user.id,
            "username": ban.user.username,
            "ban_start_time": format_datetime(ban.ban_start_time),
            "ban_end_time": format_datetime(ban.ban_end_time),
            "ban_reason": ban.ban_reason,
            "banned_token_hash": ban.banned_token_hash
        }
        for ban in active_bans
    ]

@router.post("/unban-user/{user_id}")
async def unban_user(
    user_id: int,
    db: Session = Depends(get_db),
    moderator: User = Depends(verify_moderator)
):
    """Remove an active ban from a user"""
    # Get active ban
    current_time = datetime.now()
    active_ban = db.query(UserBan).filter(
        UserBan.user_id == user_id,
        UserBan.is_active == True,
        (UserBan.ban_end_time > current_time) | (UserBan.ban_end_time == None)
    ).first()
    
    if not active_ban:
        raise HTTPException(status_code=404, detail="No active ban found for this user")
    
    # Deactivate ban
    active_ban.is_active = False
    
    # Unfreeze all user's tokens
    user_tokens = db.query(TokenMapping).filter(
        TokenMapping.user_id == user_id,
        TokenMapping.is_frozen == True
    ).all()
    
    for token in user_tokens:
        token.is_frozen = False
        token.updated_at = current_time
    
    # Create audit log
    audit_log = AuditLog(
        action_type="unban",
        moderator_id=moderator.id,
        user_id=user_id,
        action_details=f"Ban removed by moderator {moderator.username}",
        token_hash=active_ban.banned_token_hash
    )
    db.add(audit_log)
    
    db.commit()
    
    return {"message": "User unbanned successfully"}

@router.post("/warn/{token_hash}")
async def warn_user(
    token_hash: str,
    warning_reason: str,
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
        user = message.sender
    else:
        user = token.user
    
    # Create audit log for warning
    audit_log = AuditLog(
        action_type="warn",
        token_hash=token_hash,
        moderator_id=moderator.id,
        user_id=user.id,
        details=f"Warning issued: {warning_reason}"
    )
    db.add(audit_log)
    db.commit()
    
    return {
        "message": "Warning issued successfully",
        "warning_reason": warning_reason,
        "user_id": user.id,
        "username": user.username
    }

@router.get("/user-warnings/{user_id}")
async def get_user_warnings(
    user_id: int,
    db: Session = Depends(get_db),
    moderator: User = Depends(verify_moderator)
):
    """Get all warnings issued to a user"""
    warnings = db.query(AuditLog).filter(
        AuditLog.user_id == user_id,
        AuditLog.action_type == "warn"
    ).order_by(AuditLog.created_at.desc()).all()
    
    return [
        {
            "warning_id": log.id,
            "reason": log.details,
            "issued_at": log.created_at,
            "issued_by": log.moderator.username
        }
        for log in warnings
    ]

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

@router.get("/check-ban-status/{user_id}")
async def check_ban_status(
    user_id: int,
    db: Session = Depends(get_db),
    moderator: User = Depends(verify_moderator)
):
    """Check the current ban status of a user"""
    current_time = datetime.now()
    
    # Get all bans for the user
    all_bans = db.query(UserBan).filter(
        UserBan.user_id == user_id
    ).order_by(UserBan.created_at.desc()).all()
    
    # Get active bans
    active_bans = [ban for ban in all_bans if ban.is_active]
    
    # Check for expired bans that should be deactivated
    for ban in active_bans:
        if ban.ban_end_time and ban.ban_end_time <= current_time:
            ban.is_active = False
            db.commit()
    
    return {
        "user_id": user_id,
        "current_time": format_datetime(current_time),
        "all_bans": [
            {
                "id": ban.id,
                "ban_type": ban.ban_type,
                "ban_reason": ban.ban_reason,
                "ban_start_time": format_datetime(ban.ban_start_time),
                "ban_end_time": format_datetime(ban.ban_end_time),
                "is_active": ban.is_active,
                "time_until_expiry": (ban.ban_end_time - current_time).total_seconds() if ban.ban_end_time else None
            }
            for ban in all_bans
        ],
        "active_bans": [
            {
                "id": ban.id,
                "ban_type": ban.ban_type,
                "ban_reason": ban.ban_reason,
                "ban_start_time": format_datetime(ban.ban_start_time),
                "ban_end_time": format_datetime(ban.ban_end_time),
                "time_until_expiry": (ban.ban_end_time - current_time).total_seconds() if ban.ban_end_time else None
            }
            for ban in active_bans
        ]
    } 