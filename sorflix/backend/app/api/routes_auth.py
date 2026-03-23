from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, ConfigDict, Field
from sqlalchemy.orm import Session

from app.auth import create_session, get_current_session, get_current_user, hash_password, revoke_session, verify_password
from app.db import get_db
from app.models import User, UserCredential, UserSession

router = APIRouter(prefix="/auth", tags=["auth"])


class RegisterPayload(BaseModel):
    email: str = Field(..., min_length=3, max_length=255)
    password: str = Field(..., min_length=8, max_length=128)


class LoginPayload(BaseModel):
    email: str = Field(..., min_length=3, max_length=255)
    password: str = Field(..., min_length=1, max_length=128)


class UserOut(BaseModel):
    id: int
    email: str

    model_config = ConfigDict(from_attributes=True)


class AuthOut(BaseModel):
    access_token: str
    token_type: str = "bearer"
    expires_at: datetime
    user: UserOut


def _normalize_email(email: str) -> str:
    normalized = email.strip().lower()
    if "@" not in normalized or normalized.startswith("@") or normalized.endswith("@"):
        raise HTTPException(status_code=400, detail="Email invalide")
    return normalized


@router.post("/register", response_model=AuthOut, status_code=status.HTTP_201_CREATED)
def register(payload: RegisterPayload, db: Session = Depends(get_db)):
    email = _normalize_email(payload.email)

    existing = db.query(User).filter(User.email == email).first()
    if existing:
        raise HTTPException(status_code=409, detail="Email deja utilise")

    user = User(email=email)
    db.add(user)
    db.flush()  # recupere user.id sans commit intermediaire

    credential = UserCredential(user_id=user.id, password_hash=hash_password(payload.password))
    db.add(credential)
    db.commit()
    db.refresh(user)

    token, expires_at = create_session(db, user_id=user.id)
    return AuthOut(access_token=token, expires_at=expires_at, user=user)


@router.post("/login", response_model=AuthOut)
def login(payload: LoginPayload, db: Session = Depends(get_db)):
    email = _normalize_email(payload.email)

    user = db.query(User).filter(User.email == email).first()
    if not user:
        raise HTTPException(status_code=401, detail="Email ou mot de passe invalide")

    credential = db.query(UserCredential).filter(UserCredential.user_id == user.id).first()
    if not credential or not verify_password(payload.password, credential.password_hash):
        raise HTTPException(status_code=401, detail="Email ou mot de passe invalide")

    token, expires_at = create_session(db, user_id=user.id)
    return AuthOut(access_token=token, expires_at=expires_at, user=user)


@router.get("/me", response_model=UserOut)
def me(current_user: User = Depends(get_current_user)):
    return current_user


@router.post("/logout", status_code=status.HTTP_204_NO_CONTENT)
def logout(
    session: UserSession = Depends(get_current_session),
    db: Session = Depends(get_db),
):
    revoke_session(db, session)
    return None
