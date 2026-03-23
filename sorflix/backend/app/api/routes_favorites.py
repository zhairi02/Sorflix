from fastapi import APIRouter, Depends, HTTPException, Path, Query, Response, status
from pydantic import BaseModel, ConfigDict, Field
from sqlalchemy.orm import Session

from app.auth import get_current_user
from app.db import get_db
from app.models import Favorite, User

router = APIRouter(prefix="/favorites", tags=["favorites"])


class FavoriteCreate(BaseModel):
    # Mode legacy pour compatibilite avec le front actuel (user_id explicite).
    user_id: int = Field(..., ge=1)
    tmdb_movie_id: int = Field(..., ge=1)
    title: str = Field(..., min_length=1, max_length=255)
    poster: str | None = None
    year: str | None = Field(default=None, max_length=4)
    rating: float | None = None


class FavoriteCreateSelf(BaseModel):
    # Mode token-based: user deduit depuis le Bearer token.
    tmdb_movie_id: int = Field(..., ge=1)
    title: str = Field(..., min_length=1, max_length=255)
    poster: str | None = None
    year: str | None = Field(default=None, max_length=4)
    rating: float | None = None


class FavoriteOut(BaseModel):
    id: int
    user_id: int
    tmdb_movie_id: int
    title: str
    poster: str | None
    year: str | None
    rating: float | None

    model_config = ConfigDict(from_attributes=True)


@router.get("", response_model=list[FavoriteOut])
def get_favorites(
    user_id: int = Query(..., ge=1),
    db: Session = Depends(get_db),
):
    """
    Mode legacy: /favorites?user_id=...
    """
    user = db.get(User, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User introuvable")

    return (
        db.query(Favorite)
        .filter(Favorite.user_id == user_id)
        .order_by(Favorite.created_at.desc())
        .all()
    )


@router.get("/me", response_model=list[FavoriteOut])
def get_my_favorites(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Mode token-based: /favorites/me avec Authorization: Bearer <token>
    """
    return (
        db.query(Favorite)
        .filter(Favorite.user_id == current_user.id)
        .order_by(Favorite.created_at.desc())
        .all()
    )


@router.post("", response_model=FavoriteOut, status_code=status.HTTP_201_CREATED)
def add_favorite(payload: FavoriteCreate, db: Session = Depends(get_db)):
    """
    Mode legacy: POST /favorites avec user_id dans le body.
    """
    user = db.get(User, payload.user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User introuvable")

    existing = (
        db.query(Favorite)
        .filter(
            Favorite.user_id == payload.user_id,
            Favorite.tmdb_movie_id == payload.tmdb_movie_id,
        )
        .first()
    )
    if existing:
        raise HTTPException(status_code=409, detail="Film deja en favoris")

    favorite = Favorite(**payload.model_dump())
    db.add(favorite)
    db.commit()
    db.refresh(favorite)
    return favorite


@router.post("/me", response_model=FavoriteOut, status_code=status.HTTP_201_CREATED)
def add_my_favorite(
    payload: FavoriteCreateSelf,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Mode token-based: POST /favorites/me
    """
    existing = (
        db.query(Favorite)
        .filter(
            Favorite.user_id == current_user.id,
            Favorite.tmdb_movie_id == payload.tmdb_movie_id,
        )
        .first()
    )
    if existing:
        raise HTTPException(status_code=409, detail="Film deja en favoris")

    favorite = Favorite(user_id=current_user.id, **payload.model_dump())
    db.add(favorite)
    db.commit()
    db.refresh(favorite)
    return favorite


@router.delete("/{tmdb_movie_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_favorite(
    tmdb_movie_id: int = Path(..., ge=1),
    user_id: int = Query(..., ge=1),
    db: Session = Depends(get_db),
):
    """
    Mode legacy: DELETE /favorites/{id}?user_id=...
    """
    favorite = (
        db.query(Favorite)
        .filter(
            Favorite.user_id == user_id,
            Favorite.tmdb_movie_id == tmdb_movie_id,
        )
        .first()
    )
    if not favorite:
        raise HTTPException(status_code=404, detail="Favori introuvable")

    db.delete(favorite)
    db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.delete("/me/{tmdb_movie_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_my_favorite(
    tmdb_movie_id: int = Path(..., ge=1),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Mode token-based: DELETE /favorites/me/{id}
    """
    favorite = (
        db.query(Favorite)
        .filter(
            Favorite.user_id == current_user.id,
            Favorite.tmdb_movie_id == tmdb_movie_id,
        )
        .first()
    )
    if not favorite:
        raise HTTPException(status_code=404, detail="Favori introuvable")

    db.delete(favorite)
    db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)
