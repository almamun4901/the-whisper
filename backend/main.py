"""

FastAPI backend for user registration system:
1. User registration with role assignment (sender/receiver/moderator)
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
from database.database import SessionLocal, engine, Base, get_db
from database.models import User
from encryption.key_utils import generate_rsa_key_pair
from auth.jwt_auth import create_access_token, SECRET_KEY, ALGORITHM, authenticate_user, get_current_user
from jose import jwt, JWTError
import re
from typing import List, Optional
from backend.routes import message_routes, moderator_routes, user_routes

app = FastAPI(title="User Registration API")

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routes
app.include_router(message_routes.router)
app.include_router(moderator_routes.router)
app.include_router(user_routes.router)

# Admin credentials
ADMIN_USERNAME = "admin"
ADMIN_PASSWORD = "admin123"

# Database setup
Base.metadata.create_all(bind=engine)

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
    role: str = "sender"  # Default role is sender
    key_password: Optional[str] = None

    @validator('username')
    def username_must_contain_number(cls, v):
        if not any(char.isdigit() for char in v):
            raise ValueError('Username must contain at least one number')
        return v

    @validator('role')
    def validate_role(cls, v):
        if v not in ['sender', 'receiver', 'moderator']:
            raise ValueError('Role must be either "sender", "receiver", or "moderator"')
        return v

class ModeratorCreate(BaseModel):
    username: str
    password: str
    key_password: str

    @validator('username')
    def username_must_contain_number(cls, v):
        if not any(char.isdigit() for char in v):
            raise ValueError('Username must contain at least one number')
        return v

class AdminLogin(BaseModel):
    username: str
    password: str

class UserLogin(BaseModel):
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

@app.post("/register/moderator")
def register_moderator(moderator: ModeratorCreate, db: Session = Depends(get_db)):
    # Check if username exists
    if db.query(User).filter(User.username == moderator.username).first():
        raise HTTPException(status_code=400, detail="Username already exists")
    
    # Hash password using SHA-256
    hashed_password = hash_password(moderator.password)
    
    # Generate keys
    public_key, private_key = generate_rsa_key_pair()
    
    # Create moderator with pending approval
    db_user = User(
        username=moderator.username,
        password_hash=hashed_password,
        public_key=public_key,
        role="moderator",
        is_approved=False,
        status="pending"
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

@app.post("/login", response_model=Token)
def login_user(user_credentials: UserLogin, db: Session = Depends(get_db)):
    user = authenticate_user(db, user_credentials.username, user_credentials.password)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid credentials or account not approved",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    access_token_expires = timedelta(minutes=60 * 24)  # 24 hours
    access_token = create_access_token(
        data={"sub": user.username, "role": user.role},
        expires_delta=access_token_expires
    )
    
    return {"access_token": access_token, "token_type": "bearer"}

@app.get("/users/receivers")
async def get_receivers(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    # Check if user is approved and is a sender
    if not current_user.is_approved or current_user.role != "sender":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You must be an approved sender to view receivers"
        )
    
    # Get all approved receivers
    receivers = db.query(User).filter(
        User.role == "receiver",
        User.is_approved == True,
        User.status == "approved"
    ).all()
    
    return [
        {
            "id": user.id,
            "username": user.username
        }
        for user in receivers
    ]

@app.get("/debug/token")
async def debug_token(current_user: User = Depends(get_current_user)):
    """Debug endpoint to check token and user info"""
    return {
        "user_id": current_user.id,
        "username": current_user.username,
        "role": current_user.role,
        "is_approved": current_user.is_approved,
        "status": current_user.status
    } 