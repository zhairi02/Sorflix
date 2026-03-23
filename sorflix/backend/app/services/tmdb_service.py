from dotenv import load_dotenv  # type: ignore
import os
import requests  # type: ignore

load_dotenv()

TMDB_API_KEY = os.getenv("TMDB_API_KEY", "").strip()
TMDB_BASE = "https://api.themoviedb.org/3"
TMDB_IMG_BASE = "https://image.tmdb.org/t/p/w500"

class TMDBError(Exception):
    def __init__(self, message: str, status_code: int = 502) -> None:
        super().__init__(message)
        self.status_code = status_code

def tmdb_get(path: str, params: dict | None = None) -> dict:
    if not TMDB_API_KEY:
        raise TMDBError("TMDB_API_KEY manquant dans .env", status_code=500)

    url = f"{TMDB_BASE}{path}"
    p = dict(params or {})
    p["api_key"] = TMDB_API_KEY

    try:
        r = requests.get(url, params=p, timeout=15)
    except requests.RequestException as exc:
        raise TMDBError("Impossible de joindre TMDB", status_code=502) from exc

    if r.status_code == 404:
        raise TMDBError("Ressource TMDB introuvable", status_code=404)
    if r.status_code == 401:
        raise TMDBError("Clé TMDB invalide ou expirée", status_code=500)
    if r.status_code >= 500:
        raise TMDBError("TMDB indisponible", status_code=502)
    if not r.ok:
        raise TMDBError(f"Erreur TMDB: HTTP {r.status_code}", status_code=502)

    return r.json()

def normalize_tmdb_movie(m: dict) -> dict:
    poster_path = m.get("poster_path") or ""
    poster = f"{TMDB_IMG_BASE}{poster_path}" if poster_path else ""

    return {
        "id": m.get("id"),
        "title": m.get("title") or "Sans titre",
        "poster": poster,
        "overview": m.get("overview") or "",
        "rating": m.get("vote_average"),
        "year": (m.get("release_date") or "")[:4],
    }

def _normalize_list(data: dict, limit: int) -> list[dict]:
    results = data.get("results", [])
    movies = [normalize_tmdb_movie(m) for m in results]
    return movies[:limit]

def get_trending_movies(page: int = 1, limit: int = 20) -> list[dict]:
    data = tmdb_get("/trending/movie/week", params={"language": "en-US", "page": page})
    return _normalize_list(data, limit)

def get_popular_movies(page: int = 1, limit: int = 20) -> list[dict]:
    data = tmdb_get("/movie/popular", params={"language": "en-US", "page": page})
    return _normalize_list(data, limit)

def get_top_rated_movies(page: int = 1, limit: int = 20) -> list[dict]:
    data = tmdb_get("/movie/top_rated", params={"language": "en-US", "page": page})
    return _normalize_list(data, limit)

def search_movies(query: str, page: int = 1, limit: int = 20) -> list[dict]:
    data = tmdb_get(
        "/search/movie",
        params={
            "language": "en-US",
            "query": query,
            "page": page,
            "include_adult": "false",
        },
    )
    return _normalize_list(data, limit)

def get_movie(movie_id: int) -> dict:
    data = tmdb_get(f"/movie/{movie_id}", params={"language": "en-US"})
    return normalize_tmdb_movie(data)
