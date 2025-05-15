"""

The database models:

Model:
- Stores core user information for authentication and messaging
- Includes fields for username, hashed password, and role assignment
- Stores cryptographic public keys for secure message exchange
- Tracks approval status of users by administrators
- Uses SQLAlchemy ORM for database interactions
"""

from sqlalchemy import Column, Integer, String, Boolean
from database.database import Base

class User(Base):
    __tablename__ = "users"
    id = Column(Integer, primary_key=True, index=True)
    username = Column(String, unique=True, index=True, nullable=False)
    password_hash = Column(String, nullable=False)
    public_key = Column(String, nullable=False)
    role = Column(String, nullable=False)
    is_approved = Column(Boolean, default=False)
    status = Column(String, default="pending")  # "pending", "approved", or "rejected"