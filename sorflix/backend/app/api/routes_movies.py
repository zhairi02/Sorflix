from fastapi import APIRouter, HTTPException, Path, Query  # pyright: ignore[reportMissingImports]
from pydantic import BaseModel, Field

from app.services.tmdb_service import (
    TMDBError,
    get_movie,
    get_popular_movies,
    get_top_rated_movies,
    get_trending_movies,
    search_movies,
)

router = APIRouter()

class Movie(BaseModel):
    id: int | None = Field(default=None)
    title: str
    poster: str
    overview: str
    rating: float | None = Field(default=None)
    year: str

def _handle_tmdb_error(exc: TMDBError) -> None:
    raise HTTPException(status_code=exc.status_code, detail=str(exc))

@router.get("/movies/trending", response_model=list[Movie])
def trending(
    page: int = Query(default=1, ge=1, le=50),
    limit: int = Query(default=20, ge=1, le=20),
):
    try:
        return get_trending_movies(page=page, limit=limit)
    except TMDBError as exc:
        _handle_tmdb_error(exc)

@router.get("/movies/popular", response_model=list[Movie])
def popular(
    page: int = Query(default=1, ge=1, le=50),
    limit: int = Query(default=20, ge=1, le=20),
):
    try:
        return get_popular_movies(page=page, limit=limit)
    except TMDBError as exc:
        _handle_tmdb_error(exc)

@router.get("/movies/top-rated", response_model=list[Movie])
def top_rated(
    page: int = Query(default=1, ge=1, le=50),
    limit: int = Query(default=20, ge=1, le=20),
):
    try:
        return get_top_rated_movies(page=page, limit=limit)
    except TMDBError as exc:
        _handle_tmdb_error(exc)

@router.get("/movies/search", response_model=list[Movie])
def search(
    q: str = Query(..., min_length=1),
    page: int = Query(default=1, ge=1, le=50),
    limit: int = Query(default=20, ge=1, le=20),
):
    query = q.strip()
    if not query:
        raise HTTPException(status_code=400, detail="Le paramètre 'q' est obligatoire.")

    try:
        return search_movies(query=query, page=page, limit=limit)
    except TMDBError as exc:
        _handle_tmdb_error(exc)

@router.get("/movies/{movie_id}", response_model=Movie)
def movie_details(movie_id: int = Path(..., ge=1)):
    try:
        return get_movie(movie_id=movie_id)
    except TMDBError as exc:
        _handle_tmdb_error(exc)
