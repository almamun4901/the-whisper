"""
The database models:

Models:
- User: Stores core user information for authentication and messaging
- Message: Stores messages between users with encryption and metadata
- TokenMapping: Stores pseudonymous token mappings for anonymous messaging
- MessageToken: Tracks token usage per message
- Uses SQLAlchemy ORM for database interactions
"""

from sqlalchemy import Column, Integer, String, Boolean, ForeignKey, DateTime, Text, UniqueConstraint
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from database.database import Base
import datetime
from typing import Optional

class UserBan(Base):
    __tablename__ = "user_bans"
    
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    banned_token_hash = Column(String, nullable=False)  # The token that caused the ban
    ban_start_time = Column(DateTime, default=datetime.datetime.utcnow)
    ban_end_time = Column(DateTime, nullable=False)
    ban_reason = Column(Text, nullable=False)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)
    
    # Relationships
    user = relationship("User", back_populates="bans")

class User(Base):
    __tablename__ = "users"
    id = Column(Integer, primary_key=True, index=True)
    username = Column(String, unique=True, index=True, nullable=False)
    password_hash = Column(String, nullable=False)
    public_key = Column(String, nullable=False)
    role = Column(String, nullable=False)  # 'sender', 'receiver', 'moderator', or 'admin'
    is_approved = Column(Boolean, default=False)
    status = Column(String, default="pending")  # "pending", "approved", or "rejected"
    banned_until = Column(DateTime, nullable=True)  # For temporary bans
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    
    # Relationships
    sent_messages = relationship("Message", foreign_keys="Message.sender_id", back_populates="sender")
    received_messages = relationship("Message", foreign_keys="Message.recipient_id", back_populates="recipient")
    tokens = relationship("TokenMapping", back_populates="user")
    bans = relationship("UserBan", back_populates="user")

    def is_banned(self) -> bool:
        """Check if user has any active bans"""
        return any(ban.is_active for ban in self.bans)
    
    def get_active_ban(self) -> Optional["UserBan"]:
        """Get the user's active ban if any"""
        return next((ban for ban in self.bans if ban.is_active), None)

class Message(Base):
    __tablename__ = "messages"
    
    id = Column(Integer, primary_key=True, index=True)
    encrypted_content = Column(Text, nullable=False)  # Encrypted message content
    sender_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    recipient_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)
    read = Column(Boolean, default=False)
    is_flagged = Column(Boolean, default=False)  # For recipient flagging
    flag_reason = Column(Text, nullable=True)  # Reason for flagging
    token_hash = Column(String, nullable=True)  # Hash of the token used to send the message
    
    # Relationships
    sender = relationship("User", foreign_keys=[sender_id], back_populates="sent_messages")
    recipient = relationship("User", foreign_keys=[recipient_id], back_populates="received_messages")
    message_token = relationship("MessageToken", back_populates="message", uselist=False)

class TokenMapping(Base):
    __tablename__ = "token_mappings"
    
    id = Column(Integer, primary_key=True, index=True)
    token_hash = Column(String, unique=True, index=True, nullable=False)
    encrypted_user_id = Column(String, nullable=False)  # AES-encrypted user.id
    round_id = Column(Integer, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    expires_at = Column(DateTime(timezone=True))
    is_used = Column(Boolean, default=False)
    is_frozen = Column(Boolean, default=False)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    messages_sent = Column(Integer, default=0)  # Track number of messages sent with this token
    last_used_at = Column(DateTime, nullable=True)  # Track when the token was last used
    
    # Add unique constraint to ensure one token per user per round
    __table_args__ = (
        UniqueConstraint('user_id', 'round_id', name='uix_user_round_token'),
    )
    
    # Relationships
    user = relationship("User", back_populates="tokens")
    message_tokens = relationship("MessageToken", back_populates="token_mapping")

class MessageToken(Base):
    __tablename__ = "message_tokens"
    
    id = Column(Integer, primary_key=True, index=True)
    message_id = Column(Integer, ForeignKey("messages.id"), nullable=False)
    token_mapping_id = Column(Integer, ForeignKey("token_mappings.id"), nullable=False)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)
    
    # Relationships
    message = relationship("Message", back_populates="message_token")
    token_mapping = relationship("TokenMapping", back_populates="message_tokens")

class AuditLog(Base):
    __tablename__ = "audit_logs"
    
    id = Column(Integer, primary_key=True, index=True)
    action_type = Column(String, nullable=False)  # 'freeze', 'ban', 'warn'
    token_hash = Column(String, nullable=False)
    moderator_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=True)  # The user who received the action
    action_details = Column(Text, nullable=True)  # Additional details like ban duration
    created_at = Column(DateTime, default=datetime.datetime.utcnow)
    
    # Relationships
    moderator = relationship("User", foreign_keys=[moderator_id])
    user = relationship("User", foreign_keys=[user_id])