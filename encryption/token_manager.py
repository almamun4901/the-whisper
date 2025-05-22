"""
Token Manager for handling pseudonymous tokens:
- Generates and validates tokens
- Handles token encryption/decryption
- Manages token lifecycle (creation, usage, freezing)
"""

import hashlib
import jwt
import datetime
from cryptography.fernet import Fernet
from database.models import TokenMapping, User
from database.database import SessionLocal
from typing import Optional, Tuple

class TokenManager:
    def __init__(self, secret_key: str, encryption_key: bytes):
        """Initialize TokenManager with secret key for JWT and encryption key for AES"""
        self.secret_key = secret_key
        self.fernet = Fernet(encryption_key)
    
    def generate_token_hash(self, user_id: int, round_id: int) -> str:
        """Generate SHA-256 hash of user.id + round_id"""
        return hashlib.sha256(f"{user_id}{round_id}".encode()).hexdigest()
    
    def encrypt_user_id(self, user_id: int) -> str:
        """Encrypt user.id using AES"""
        return self.fernet.encrypt(str(user_id).encode()).decode()
    
    def decrypt_user_id(self, encrypted_id: str) -> int:
        """Decrypt user.id using AES"""
        return int(self.fernet.decrypt(encrypted_id.encode()).decode())
    
    def create_token(self, user_id: int, round_id: int) -> str:
        """Create a new token for a user in a round"""
        token_hash = self.generate_token_hash(user_id, round_id)
        encrypted_user_id = self.encrypt_user_id(user_id)
        expires_at = datetime.datetime.utcnow() + datetime.timedelta(hours=24)
        
        db = SessionLocal()
        try:
            token_mapping = TokenMapping(
                token_hash=token_hash,
                encrypted_user_id=encrypted_user_id,
                round_id=round_id,
                expires_at=expires_at,
                user_id=user_id
            )
            db.add(token_mapping)
            db.commit()
            return token_hash
        finally:
            db.close()
    
    def validate_token(self, token_hash: str) -> Tuple[bool, Optional[int]]:
        """Validate a token and mark it as used. Returns (is_valid, user_id)"""
        db = SessionLocal()
        try:
            token = db.query(TokenMapping).filter(
                TokenMapping.token_hash == token_hash,
                TokenMapping.is_used == False,
                TokenMapping.is_frozen == False,
                TokenMapping.expires_at > datetime.datetime.utcnow()
            ).first()
            
            if token:
                token.is_used = True
                db.commit()
                return True, token.user_id
            return False, None
        finally:
            db.close()
    
    def freeze_token(self, token_hash: str) -> bool:
        """Freeze a token (moderator action)"""
        db = SessionLocal()
        try:
            token = db.query(TokenMapping).filter(
                TokenMapping.token_hash == token_hash
            ).first()
            if token:
                token.is_frozen = True
                db.commit()
                return True
            return False
        finally:
            db.close()
    
    def get_user_from_token(self, token_hash: str) -> Optional[User]:
        """Get user from token hash (admin only)"""
        db = SessionLocal()
        try:
            token = db.query(TokenMapping).filter(
                TokenMapping.token_hash == token_hash
            ).first()
            return token.user if token else None
        finally:
            db.close()
    
    def refresh_tokens_for_round(self, round_id: int) -> None:
        """Refresh tokens for a new round (admin only)"""
        db = SessionLocal()
        try:
            # Expire all tokens from previous round
            db.query(TokenMapping).filter(
                TokenMapping.round_id == round_id - 1
            ).update({
                "expires_at": datetime.datetime.utcnow()
            })
            db.commit()
        finally:
            db.close() 