"""
The database models:

Models:
- User: Stores core user information for authentication and messaging
- Message: Stores messages between users with encryption and metadata
- TokenMapping: Stores pseudonymous token mappings for anonymous messaging
- Uses SQLAlchemy ORM for database interactions
"""

from sqlalchemy import Column, Integer, String, Boolean, ForeignKey, DateTime, Text
from sqlalchemy.orm import relationship
from database.database import Base
import datetime

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
    
    # Relationships
    sent_messages = relationship("Message", foreign_keys="Message.sender_id", back_populates="sender")
    received_messages = relationship("Message", foreign_keys="Message.recipient_id", back_populates="recipient")
    token_mappings = relationship("TokenMapping", back_populates="user")

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

class TokenMapping(Base):
    __tablename__ = "token_mappings"
    
    id = Column(Integer, primary_key=True, index=True)
    token_hash = Column(String, unique=True, index=True, nullable=False)
    encrypted_user_id = Column(String, nullable=False)  # AES-encrypted user.id
    round_id = Column(Integer, nullable=False)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)
    expires_at = Column(DateTime, nullable=False)
    is_used = Column(Boolean, default=False)
    is_frozen = Column(Boolean, default=False)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    
    # Relationships
    user = relationship("User", back_populates="token_mappings")

class AuditLog(Base):
    __tablename__ = "audit_logs"
    
    id = Column(Integer, primary_key=True, index=True)
    action_type = Column(String, nullable=False)  # 'freeze', 'ban', 'warn'
    token_hash = Column(String, nullable=False)
    moderator_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    action_details = Column(Text, nullable=True)  # Additional details like ban duration
    created_at = Column(DateTime, default=datetime.datetime.utcnow)
    
    # Relationships
    moderator = relationship("User", foreign_keys=[moderator_id])