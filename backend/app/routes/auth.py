from datetime import datetime
from typing import List

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import User
from app.auth import (
    hash_password,
    verify_password,
    create_access_token,
    get_current_user,
    require_role,
)

router = APIRouter(prefix="/api/auth", tags=["auth"])


class LoginRequest(BaseModel):
    username: str
    password: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user_id: int
    username: str
    role: str
    is_active: bool


class UserCreateRequest(BaseModel):
    username: str
    password: str
    role: str = "INVENTORY_ANALYST"
    is_active: bool = True


class UserUpdateRequest(BaseModel):
    role: str


class UserPasswordChange(BaseModel):
    new_password: str


class UserStatusChange(BaseModel):
    is_active: bool


class UserOut(BaseModel):
    id: int
    username: str
    role: str
    is_active: bool
    created_at: datetime

    class Config:
        from_attributes = True


ROLE_OPTIONS = ["SYSTEM_ADMIN", "INVENTORY_MANAGER", "INVENTORY_ANALYST"]
CREATE_ROLE_OPTIONS = ["INVENTORY_MANAGER", "INVENTORY_ANALYST"]


@router.post("/login", response_model=TokenResponse)
def login(request: LoginRequest, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.username == request.username).first()
    if not user or not verify_password(request.password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid username or password",
        )
    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Your account is inactive. Please contact the System Administrator.",
        )
    token = create_access_token({"sub": str(user.id), "role": user.role})
    return TokenResponse(
        access_token=token,
        user_id=user.id,
        username=user.username,
        role=user.role,
        is_active=user.is_active,
    )


@router.get("/me", response_model=UserOut)
def get_me(current_user: User = Depends(get_current_user)):
    return current_user


@router.post("/logout")
def logout():
    return {"message": "Logged out successfully"}


@router.get("/users", response_model=List[UserOut])
def list_users(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(["SYSTEM_ADMIN"])),
):
    return db.query(User).order_by(User.created_at.desc()).all()


@router.post("/users", response_model=UserOut, status_code=status.HTTP_201_CREATED)
def create_user(
    request: UserCreateRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(["SYSTEM_ADMIN"])),
):
    if request.role not in CREATE_ROLE_OPTIONS:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Role must be one of: {', '.join(CREATE_ROLE_OPTIONS)}",
        )
    if len(request.username.strip()) < 3:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Username must be at least 3 characters",
        )
    if len(request.password) < 6:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Password must be at least 6 characters",
        )
    existing = db.query(User).filter(User.username == request.username.strip()).first()
    if existing:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Username already exists",
        )
    user = User(
        username=request.username.strip(),
        password_hash=hash_password(request.password),
        role=request.role,
        is_active=request.is_active,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


@router.get("/users/{user_id}", response_model=UserOut)
def get_user(
    user_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(["SYSTEM_ADMIN"])),
):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return user


@router.patch("/users/{user_id}", response_model=UserOut)
def update_user(
    user_id: int,
    request: UserUpdateRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(["SYSTEM_ADMIN"])),
):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    if request.role not in ROLE_OPTIONS:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Role must be one of: {', '.join(ROLE_OPTIONS)}",
        )
    user.role = request.role
    db.commit()
    db.refresh(user)
    return user


@router.patch("/users/{user_id}/password")
def change_user_password(
    user_id: int,
    request: UserPasswordChange,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(["SYSTEM_ADMIN"])),
):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    if len(request.new_password) < 6:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Password must be at least 6 characters",
        )
    user.password_hash = hash_password(request.new_password)
    db.commit()
    return {"message": "Password updated successfully"}


@router.patch("/users/{user_id}/status", response_model=UserOut)
def change_user_status(
    user_id: int,
    request: UserStatusChange,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(["SYSTEM_ADMIN"])),
):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    if user.role == "SYSTEM_ADMIN" and not request.is_active:
        admins = db.query(User).filter(User.role == "SYSTEM_ADMIN", User.is_active == True).count()
        if admins <= 1:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Cannot deactivate the last active System Administrator",
            )
    user.is_active = request.is_active
    db.commit()
    db.refresh(user)
    return user


@router.patch("/users/{user_id}/role", response_model=UserOut)
def change_user_role(
    user_id: int,
    request: UserUpdateRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(["SYSTEM_ADMIN"])),
):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    if request.role not in ROLE_OPTIONS:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Role must be one of: {', '.join(ROLE_OPTIONS)}",
        )
    user.role = request.role
    db.commit()
    db.refresh(user)
    return user
