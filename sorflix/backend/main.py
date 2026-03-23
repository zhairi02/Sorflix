from fastapi import FastAPI  # pyright: ignore[reportMissingImports]
from fastapi.middleware.cors import CORSMiddleware  # type: ignore

from app.api.routes_auth import router as auth_router
from app.api.routes_favorites import router as favorites_router
from app.api.routes_movies import router as movies_router
from app.db import Base, engine

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(movies_router)
app.include_router(favorites_router)
app.include_router(auth_router)


@app.on_event("startup")
def on_startup() -> None:
    """
    Startup minimal pour le MVP:
    - cree les tables SQL si elles n'existent pas
    """
    Base.metadata.create_all(bind=engine)
