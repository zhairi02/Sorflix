import os

from dotenv import load_dotenv  # type: ignore
from sqlalchemy import create_engine
from sqlalchemy.orm import declarative_base, sessionmaker

# On charge les variables du fichier .env pour recuperer DATABASE_URL.
load_dotenv()

DATABASE_URL = os.getenv("DATABASE_URL", "").strip()
if not DATABASE_URL:
    raise RuntimeError("DATABASE_URL manquant dans backend/.env")

# Engine = connexion principale vers PostgreSQL.
# pool_pre_ping evite les connexions mortes quand l'API reste allumee longtemps.
engine = create_engine(DATABASE_URL, pool_pre_ping=True)

# SessionLocal = usine a sessions SQLAlchemy.
# Une session = un contexte de travail DB pour une requete HTTP.
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

# Base = classe racine pour tous les modeles SQLAlchemy (User, Favorite, etc.).
Base = declarative_base()


def get_db():
    """
    Dependency FastAPI:
    - ouvre une session DB au debut de la requete
    - ferme proprement la session a la fin
    """
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
