"""NexusID — Authentication System.

JWT-based authentication with role-based access control.
Users: admin, reviewer, analyst (pre-seeded).
"""

from __future__ import annotations

import os
from datetime import datetime, timedelta
from typing import Optional

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from jose import JWTError, jwt
from passlib.context import CryptContext
from pydantic import BaseModel
from sqlalchemy import Column, String, DateTime, Boolean
from sqlalchemy.orm import Session

from backend.models import Base, get_db

SECRET_KEY = os.getenv("JWT_SECRET", "nexusid-jwt-secret-change-in-production-2024")
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 480

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
security = HTTPBearer(auto_error=False)


class UserDB(Base):
    __tablename__ = "users"
    username = Column(String, primary_key=True)
    hashed_password = Column(String, nullable=False)
    full_name = Column(String, nullable=False)
    role = Column(String, nullable=False, default="reviewer")
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    last_login = Column(DateTime, nullable=True)


class LoginRequest(BaseModel):
    username: str
    password: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    username: str
    full_name: str
    role: str
    expires_in: int


def hash_password(password: str) -> str:
    return pwd_context.hash(password)

def verify_password(plain: str, hashed: str) -> bool:
    return pwd_context.verify(plain, hashed)

def create_token(username: str, role: str) -> tuple[str, int]:
    expires = timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    payload = {"sub": username, "role": role, "exp": datetime.utcnow() + expires, "iat": datetime.utcnow()}
    token = jwt.encode(payload, SECRET_KEY, algorithm=ALGORITHM)
    return token, int(expires.total_seconds())

def decode_token(token: str) -> dict:
    try:
        return jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
    except JWTError:
        raise HTTPException(status_code=401, detail="Invalid or expired token")

def get_current_user(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(security),
    db: Session = Depends(get_db),
) -> Optional["UserDB"]:
    if not credentials:
        return None
    payload = decode_token(credentials.credentials)
    username = payload.get("sub")
    if not username:
        raise HTTPException(status_code=401, detail="Invalid token")
    user = db.query(UserDB).filter(UserDB.username == username).first()
    if not user or not user.is_active:
        raise HTTPException(status_code=401, detail="User not found or inactive")
    return user

def require_auth(
    credentials: HTTPAuthorizationCredentials = Depends(HTTPBearer()),
    db: Session = Depends(get_db),
) -> "UserDB":
    payload = decode_token(credentials.credentials)
    username = payload.get("sub")
    user = db.query(UserDB).filter(UserDB.username == username).first()
    if not user or not user.is_active:
        raise HTTPException(status_code=401, detail="User not found or inactive")
    return user

def require_admin(user = Depends(require_auth)):
    if user.role != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    return user

DEFAULT_USERS = [
    {"username": "admin", "password": "admin123", "full_name": "System Administrator", "role": "admin"},
    {"username": "reviewer1", "password": "review123", "full_name": "Priya Sharma", "role": "reviewer"},
    {"username": "reviewer2", "password": "review123", "full_name": "Rahul Kumar", "role": "reviewer"},
    {"username": "analyst", "password": "analyst123", "full_name": "Ananya Rao", "role": "analyst"},
]

def seed_users(db: Session):
    for u in DEFAULT_USERS:
        existing = db.query(UserDB).filter(UserDB.username == u["username"]).first()
        if not existing:
            user = UserDB(
                username=u["username"],
                hashed_password=hash_password(u["password"]),
                full_name=u["full_name"],
                role=u["role"],
            )
            db.add(user)
    db.commit()
