"""
Simple FastAPI app for testing
"""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

app = FastAPI(title="Simple API")

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Dummy data for testing
users = [
    {"id": 1, "username": "user1", "role": "sender", "status": "approved"},
    {"id": 2, "username": "user2", "role": "receiver", "status": "pending"}
]

@app.get("/")
def read_root():
    return {"message": "API is running"}

@app.get("/users")
def get_users():
    return users

@app.get("/users/{user_id}")
def get_user(user_id: int):
    user = next((u for u in users if u["id"] == user_id), None)
    if user:
        return user
    return {"error": "User not found"}

# Run with: uvicorn simple_api:app --reload 