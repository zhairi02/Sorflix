import hashlib
import hmac
import secrets
from datetime import datetime, timedelta, timezone

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session

from app.db import get_db
from app.models import User, UserSession

security = HTTPBearer()

PASSWORD_ALGO = "pbkdf2_sha256"
PASSWORD_ITERATIONS = 390000
SESSION_TTL_DAYS = 7


def _auth_error(detail: str = "Token invalide ou expire") -> HTTPException:
    return HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail=detail,
        headers={"WWW-Authenticate": "Bearer"},
    )


def hash_password(password: str) -> str:
    """
    Hash mot de passe avec PBKDF2-HMAC-SHA256.
    Format stocke: algo$iterations$salt_hex$hash_hex
    """
    salt = secrets.token_bytes(16)
    dk = hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"), salt, PASSWORD_ITERATIONS)
    return f"{PASSWORD_ALGO}${PASSWORD_ITERATIONS}${salt.hex()}${dk.hex()}"


def verify_password(password: str, stored_hash: str) -> bool:
    try:
        algo, iterations_raw, salt_hex, hash_hex = stored_hash.split("$", 3)
        if algo != PASSWORD_ALGO:
            return False
        iterations = int(iterations_raw)
        salt = bytes.fromhex(salt_hex)
    except (ValueError, TypeError):
        return False

    candidate = hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"), salt, iterations)
    try:
        expected = bytes.fromhex(hash_hex)
    except ValueError:
        return False

    return hmac.compare_digest(candidate, expected)


def hash_token(raw_token: str) -> str:
    return hashlib.sha256(raw_token.encode("utf-8")).hexdigest()


def create_session(db: Session, user_id: int) -> tuple[str, datetime]:
    """
    Cree une session et retourne (token_brut, expiration).
    Le token brut est renvoye UNE seule fois au client.
    """
    raw_token = secrets.token_urlsafe(48)
    expires_at = datetime.now(timezone.utc) + timedelta(days=SESSION_TTL_DAYS)

    session = UserSession(
        user_id=user_id,
        token_hash=hash_token(raw_token),
        expires_at=expires_at,
        revoked_at=None,
    )
    db.add(session)
    db.commit()
    db.refresh(session)
    return raw_token, session.expires_at


def get_current_session(
    credentials: HTTPAuthorizationCredentials = Depends(security),
    db: Session = Depends(get_db),
) -> UserSession:
    if credentials.scheme.lower() != "bearer":
        raise _auth_error("Schema d'authentification invalide")

    token = credentials.credentials.strip()
    if not token:
        raise _auth_error()

    now = datetime.now(timezone.utc)
    session = (
        db.query(UserSession)
        .filter(
            UserSession.token_hash == hash_token(token),
            UserSession.revoked_at.is_(None),
            UserSession.expires_at > now,
        )
        .first()
    )
    if not session:
        raise _auth_error()

    return session


def get_current_user(
    session: UserSession = Depends(get_current_session),
    db: Session = Depends(get_db),
) -> User:
    user = db.get(User, session.user_id)
    if not user:
        raise _auth_error("Utilisateur introuvable pour ce token")
    return user


def revoke_session(db: Session, session: UserSession) -> None:
    if session.revoked_at is None:
        session.revoked_at = datetime.now(timezone.utc)
        db.add(session)
        db.commit()
