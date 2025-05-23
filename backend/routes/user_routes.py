"""
User routes for the application.
Handles user-related endpoints like getting user info, listing receivers, etc.
"""

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List
from pydantic import BaseModel
import datetime

from database.database import get_db
from database.models import User, AuditLog, TokenMapping
from auth.jwt_auth import get_current_user

router = APIRouter(
    prefix="/users",
    tags=["users"]
)

class UserResponse(BaseModel):
    id: int
    username: str
    role: str
    is_approved: bool
    status: str

    class Config:
        from_attributes = True

@router.get("/me", response_model=UserResponse)
async def get_current_user_info(current_user: User = Depends(get_current_user)):
    """Get information about the currently logged in user"""
    return {
        "id": current_user.id,
        "username": current_user.username,
        "role": current_user.role,
        "is_approved": current_user.is_approved,
        "status": current_user.status
    }

@router.get("/receivers")
async def get_receivers(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get list of approved receivers"""
    # Check if user is approved and is a sender
    if not current_user.is_approved:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="User not approved"
        )
    
    if current_user.role != "sender":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only senders can view receivers"
        )
    
    # Get all approved receivers
    receivers = db.query(User).filter(
        User.role == "receiver",
        User.is_approved == True
    ).all()
    
    return [
        {
            "id": receiver.id,
            "username": receiver.username,
            "public_key": receiver.public_key
        }
        for receiver in receivers
    ]

@router.get("/token-status")
async def get_user_token_status(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get the status of the user's current token"""
    # Check if user is banned
    if current_user.banned_until and current_user.banned_until > datetime.datetime.utcnow():
        return {
            "status": "banned",
            "banned_until": current_user.banned_until,
            "message": f"Banned until {current_user.banned_until}"
        }
    
    # Check for warnings
    warning = db.query(AuditLog).filter(
        AuditLog.user_id == current_user.id,
        AuditLog.action_type == "warn",
        AuditLog.created_at >= datetime.datetime.utcnow() - datetime.timedelta(days=7)  # Last 7 days
    ).first()
    
    if warning:
        return {
            "status": "warning",
            "warning_date": warning.created_at,
            "message": "You have received a warning from a moderator"
        }
    
    # Check for frozen tokens
    frozen_token = db.query(TokenMapping).filter(
        TokenMapping.user_id == current_user.id,
        TokenMapping.is_frozen == True
    ).first()
    
    if frozen_token:
        return {
            "status": "frozen",
            "frozen_since": frozen_token.created_at,
            "message": "Your token has been frozen by a moderator"
        }
    
    return {
        "status": "active",
        "message": "Your account is in good standing"
    } 