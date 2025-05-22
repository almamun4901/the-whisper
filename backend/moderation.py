"""
Moderation Service for handling token-related actions:
- Token freezing
- Temporary bans
- Warning issuance
- Audit logging
"""

import datetime
from typing import Optional
from database.models import User, TokenMapping, Message
from database.database import SessionLocal
from encryption.token_manager import TokenManager

class ModerationService:
    def __init__(self, token_manager: TokenManager):
        self.token_manager = token_manager
    
    def flag_message(self, message_id: int, reason: str) -> bool:
        """Flag a message as abusive (recipient action)"""
        db = SessionLocal()
        try:
            message = db.query(Message).filter(Message.id == message_id).first()
            if message:
                message.is_flagged = True
                message.flag_reason = reason
                db.commit()
                return True
            return False
        finally:
            db.close()
    
    def freeze_token(self, token_hash: str) -> bool:
        """Freeze a token (moderator action)"""
        return self.token_manager.freeze_token(token_hash)
    
    def issue_temporary_ban(self, token_hash: str, duration_hours: int) -> bool:
        """Issue a temporary ban based on token hash (moderator action)"""
        db = SessionLocal()
        try:
            user = self.token_manager.get_user_from_token(token_hash)
            if user:
                user.banned_until = datetime.datetime.utcnow() + datetime.timedelta(hours=duration_hours)
                db.commit()
                return True
            return False
        finally:
            db.close()
    
    def issue_warning(self, token_hash: str) -> bool:
        """Issue a warning based on token hash (moderator action)"""
        # In a real system, you might want to store warnings in a separate table
        # For now, we'll just freeze the token as a warning
        return self.freeze_token(token_hash)
    
    def get_flagged_messages(self) -> list:
        """Get all flagged messages (moderator view)"""
        db = SessionLocal()
        try:
            return db.query(Message).filter(Message.is_flagged == True).all()
        finally:
            db.close()
    
    def get_token_status(self, token_hash: str) -> dict:
        """Get status of a token (moderator view)"""
        db = SessionLocal()
        try:
            token = db.query(TokenMapping).filter(TokenMapping.token_hash == token_hash).first()
            if token:
                return {
                    "is_used": token.is_used,
                    "is_frozen": token.is_frozen,
                    "expires_at": token.expires_at,
                    "created_at": token.created_at
                }
            return None
        finally:
            db.close() 