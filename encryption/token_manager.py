"""
Token Manager for handling pseudonymous tokens:
- Generates and validates tokens
- Handles token encryption/decryption
- Manages token lifecycle (creation, usage, freezing)
- Implements one-token-per-round system
"""

import hashlib
import jwt
import datetime
from cryptography.hazmat.primitives.ciphers import Cipher, algorithms, modes
from cryptography.hazmat.primitives import padding
from cryptography.hazmat.backends import default_backend
import base64
from database.models import TokenMapping, User, MessageToken
from database.database import SessionLocal
from typing import Optional, Tuple
from sqlalchemy.exc import IntegrityError

class TokenManager:
    def __init__(self, secret_key: str, encryption_key: str):
        """Initialize TokenManager with secret key for JWT and encryption key for AES"""
        self.secret_key = secret_key
        # Convert encryption key to 32 bytes using SHA-256
        self.encryption_key = hashlib.sha256(encryption_key.encode()).digest()
        self.backend = default_backend()
    
    def generate_token_hash(self, user_id: int, round_id: int) -> str:
        """Generate SHA-256 hash of user.id + round_id"""
        return hashlib.sha256(f"{user_id}{round_id}".encode()).hexdigest()
    
    def encrypt_user_id(self, user_id: int) -> str:
        """Encrypt user.id using AES"""
        # Convert user_id to bytes
        data = str(user_id).encode()
        
        # Add padding
        padder = padding.PKCS7(algorithms.AES.block_size).padder()
        padded_data = padder.update(data) + padder.finalize()
        
        # Generate a random IV
        iv = b'\x00' * 16  # For simplicity, using zero IV. In production, use os.urandom(16)
        
        # Create cipher
        cipher = Cipher(
            algorithms.AES(self.encryption_key),
            modes.CBC(iv),
            backend=self.backend
        )
        encryptor = cipher.encryptor()
        
        # Encrypt the data
        encrypted_data = encryptor.update(padded_data) + encryptor.finalize()
        
        # Combine IV and encrypted data and encode as base64
        return base64.b64encode(iv + encrypted_data).decode()
    
    def decrypt_user_id(self, encrypted_id: str) -> int:
        """Decrypt user.id using AES"""
        # Decode from base64
        encrypted_data = base64.b64decode(encrypted_id.encode())
        
        # Extract IV and ciphertext
        iv = encrypted_data[:16]
        ciphertext = encrypted_data[16:]
        
        # Create cipher
        cipher = Cipher(
            algorithms.AES(self.encryption_key),
            modes.CBC(iv),
            backend=self.backend
        )
        decryptor = cipher.decryptor()
        
        # Decrypt the data
        padded_data = decryptor.update(ciphertext) + decryptor.finalize()
        
        # Remove padding
        unpadder = padding.PKCS7(algorithms.AES.block_size).unpadder()
        data = unpadder.update(padded_data) + unpadder.finalize()
        
        # Convert back to integer
        return int(data.decode())
    
    def get_or_create_token(self, user_id: int, round_id: int) -> Tuple[str, bool]:
        """
        Get existing token for user in round or create new one.
        Returns (token_hash, is_new_token)
        """
        db = SessionLocal()
        try:
            # Try to get existing token for this user and round
            token = db.query(TokenMapping).filter(
                TokenMapping.user_id == user_id,
                TokenMapping.round_id == round_id,
                TokenMapping.is_frozen == False,
                TokenMapping.expires_at > datetime.datetime.utcnow()
            ).first()
            
            if token:
                return token.token_hash, False
            
            # Create new token if none exists
            token_hash = self.generate_token_hash(user_id, round_id)
            encrypted_user_id = self.encrypt_user_id(user_id)
            expires_at = datetime.datetime.utcnow() + datetime.timedelta(hours=24)
            
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
                return token_hash, True
            except IntegrityError:
                # Handle race condition where token was created by another process
                db.rollback()
                token = db.query(TokenMapping).filter(
                    TokenMapping.user_id == user_id,
                    TokenMapping.round_id == round_id
                ).first()
                return token.token_hash, False
        finally:
            db.close()
    
    def validate_token_for_message(self, token_hash: str, user_id: int) -> Tuple[bool, str]:
        """
        Validate a token for sending a message.
        Returns (is_valid, error_message)
        """
        db = SessionLocal()
        try:
            token = db.query(TokenMapping).filter(
                TokenMapping.token_hash == token_hash,
                TokenMapping.user_id == user_id,
                TokenMapping.is_frozen == False,
                TokenMapping.expires_at > datetime.datetime.utcnow()
            ).first()
            
            if not token:
                return False, "Token not found or expired"
            
            if token.is_used:
                return False, "Token has already been used in this round"
            
            # Update token usage
            token.is_used = True
            token.messages_sent += 1
            token.last_used_at = datetime.datetime.utcnow()
            db.commit()
            
            return True, ""
        finally:
            db.close()
    
    def record_message_token(self, message_id: int, token_hash: str) -> bool:
        """Record the token usage for a specific message"""
        db = SessionLocal()
        try:
            token = db.query(TokenMapping).filter(
                TokenMapping.token_hash == token_hash
            ).first()
            
            if not token:
                return False
            
            message_token = MessageToken(
                message_id=message_id,
                token_mapping_id=token.id
            )
            db.add(message_token)
            db.commit()
            return True
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
    
    def get_token_stats(self, token_hash: str) -> dict:
        """Get statistics about a token's usage"""
        db = SessionLocal()
        try:
            token = db.query(TokenMapping).filter(
                TokenMapping.token_hash == token_hash
            ).first()
            
            if not token:
                return None
            
            return {
                "token_hash": token.token_hash,
                "user_id": token.user_id,
                "round_id": token.round_id,
                "messages_sent": token.messages_sent,
                "created_at": token.created_at,
                "last_used_at": token.last_used_at,
                "expires_at": token.expires_at,
                "is_frozen": token.is_frozen,
                "is_used": token.is_used
            }
        finally:
            db.close() 