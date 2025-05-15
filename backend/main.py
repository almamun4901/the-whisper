"""

FastAPI backend for user registration system:
1. User registration with role assignment (sender/receiver)
2. Admin approval for new user registrations
3. User status checking
4. Password hashing for security
5. JWT token-based authentication for admin
6. Database integration using SQLAlchemy
"""

import sys
import os

# Add parent directory to Python path
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from fastapi import FastAPI, HTTPException, Depends, status, Header
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, validator
from sqlalchemy.orm import Session
from datetime import timedelta
import hashlib
from database.database import SessionLocal, engine, Base
from database.models import User
from encryption.key_utils import generate_rsa_key_pair
from auth.jwt_auth import create_access_token, SECRET_KEY, ALGORITHM
from jose import jwt, JWTError
import re
from typing import List, Optional

app = FastAPI(title="User Registration API")

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # In production, replace with specific origins
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Admin credentials
ADMIN_USERNAME = "admin"
ADMIN_PASSWORD = "admin123"

# Database setup
Base.metadata.create_all(bind=engine)

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

# Hash password using SHA-256
def hash_password(password: str) -> str:
    """Hash password using SHA-256"""
    return hashlib.sha256(password.encode()).hexdigest()

async def verify_admin_token(authorization: str = Header(None)):
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid authentication credentials",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    token = authorization.split(" ")[1]
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        username = payload.get("sub")
        role = payload.get("role")
        
        if username != ADMIN_USERNAME or role != "admin":
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Not authorized",
            )
        
        return {"username": username, "role": role}
    except JWTError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Could not validate credentials",
            headers={"WWW-Authenticate": "Bearer"},
        )

class UserCreate(BaseModel):
    username: str
    password: str
    role: str

    @validator('role')
    def validate_role(cls, v):
        if v not in ['sender', 'receiver']:
            raise ValueError('Role must be either "sender" or "receiver"')
        return v

class AdminLogin(BaseModel):
    username: str
    password: str

class Token(BaseModel):
    access_token: str
    token_type: str

@app.post("/register")
def register(user: UserCreate, db: Session = Depends(get_db)):
    # Check if username exists
    if db.query(User).filter(User.username == user.username).first():
        raise HTTPException(status_code=400, detail="Username already exists")
    
    # Hash password using SHA-256
    hashed_password = hash_password(user.password)
    
    # Generate keys
    public_key, private_key = generate_rsa_key_pair()
    
    # Create user with pending approval
    db_user = User(
        username=user.username,
        password_hash=hashed_password,
        public_key=public_key,
        role=user.role,
        is_approved=False,
        status="pending"  # Add status field
    )
    db.add(db_user)
    db.commit()
    db.refresh(db_user)
    
    return {
        "id": db_user.id,
        "username": db_user.username,
        "role": db_user.role,
        "status": "pending",
        "public_key": db_user.public_key,
        "private_key": private_key
    }

@app.post("/admin/login", response_model=Token)
def admin_login(admin: AdminLogin):
    if admin.username != ADMIN_USERNAME or admin.password != ADMIN_PASSWORD:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid admin credentials",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    # Create access token
    access_token_expires = timedelta(minutes=60 * 24)  # 24 hours
    access_token = create_access_token(
        data={"sub": admin.username, "role": "admin"},
        expires_delta=access_token_expires
    )
    
    return {"access_token": access_token, "token_type": "bearer"}

@app.get("/admin/pending-users")
async def get_pending_users(db: Session = Depends(get_db), admin = Depends(verify_admin_token)):
    pending_users = db.query(User).filter(User.status == "pending").all()
    return [
        {
            "id": user.id,
            "username": user.username,
            "role": user.role,
            "status": user.status
        }
        for user in pending_users
    ]

@app.post("/admin/approve-user/{user_id}")
async def approve_user(user_id: int, db: Session = Depends(get_db), admin = Depends(verify_admin_token)):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    user.is_approved = True
    user.status = "approved"
    db.commit()
    
    return {
        "id": user.id,
        "username": user.username,
        "role": user.role,
        "status": "approved"
    }

@app.post("/admin/reject-user/{user_id}")
async def reject_user(user_id: int, db: Session = Depends(get_db), admin = Depends(verify_admin_token)):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    user.is_approved = False
    user.status = "rejected"
    db.commit()
    
    return {
        "id": user.id,
        "username": user.username,
        "role": user.role,
        "status": "rejected"
    }

@app.get("/status")
def check_user_status(username: str, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.username == username).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    return {
        "username": user.username,
        "role": user.role,
        "status": user.status
    } 