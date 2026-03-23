import { useEffect, useMemo, useState } from "react";
import "./App.css";
import MovieRow from "./components/movieRow";
import MovieGrid from "./components/movieGrid";
import MovieModal from "./components/movieModal";

const API_BASE = "http://127.0.0.1:8000";
const TOKEN_STORAGE_KEY = "sorflix_access_token";

function getStoredToken() {
  try {
    return localStorage.getItem(TOKEN_STORAGE_KEY) || "";
  } catch {
    return "";
  }
}

function setStoredToken(token) {
  try {
    localStorage.setItem(TOKEN_STORAGE_KEY, token);
  } catch {
    // ignore storage errors
  }
}

function clearStoredToken() {
  try {
    localStorage.removeItem(TOKEN_STORAGE_KEY);
  } catch {
    // ignore storage errors
  }
}

async function apiRequest(path, { method = "GET", params = {}, body, token = "" } = {}) {
  const url = new URL(`${API_BASE}${path}`);
  Object.entries(params).forEach(([key, value]) => {
    if (value === undefined || value === null || value === "") return;
    url.searchParams.set(key, String(value));
  });

  const options = { method, headers: {} };
  if (token) {
    options.headers.Authorization = `Bearer ${token}`;
  }
  if (body !== undefined) {
    options.headers["Content-Type"] = "application/json";
    options.body = JSON.stringify(body);
  }

  const res = await fetch(url, options);
  if (!res.ok) {
    let message = `Erreur API: HTTP ${res.status}`;
    try {
      const payload = await res.json();
      if (typeof payload?.detail === "string" && payload.detail.trim() !== "") {
        message = payload.detail;
      } else if (Array.isArray(payload?.detail) && payload.detail.length > 0) {
        const firstIssue = payload.detail[0];
        if (typeof firstIssue?.msg === "string" && firstIssue.msg.trim() !== "") {
          message = firstIssue.msg;
        }
      }
    } catch {
      // ignore JSON parsing error, keep default message
    }
    throw new Error(message);
  }

  if (res.status === 204) return null;
  return await res.json();
}

function toFavoriteIdSet(favorites = []) {
  return new Set(favorites.map((item) => item.tmdb_movie_id));
}

export default function App() {
  const [authStage, setAuthStage] = useState("checking");
  const [authToken, setAuthToken] = useState(() => getStoredToken());
  const [currentUser, setCurrentUser] = useState(null);
  const [authError, setAuthError] = useState("");

  const [authMode, setAuthMode] = useState("login");
  const [authEmail, setAuthEmail] = useState("");
  const [authPassword, setAuthPassword] = useState("");
  const [authSubmitLoading, setAuthSubmitLoading] = useState(false);

  const [trending, setTrending] = useState([]);
  const [popular, setPopular] = useState([]);
  const [topRated, setTopRated] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [favoriteIds, setFavoriteIds] = useState(new Set());
  const [favoritesInitError, setFavoritesInitError] = useState("");

  const [searchQuery, setSearchQuery] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchResults, setSearchResults] = useState([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchError, setSearchError] = useState("");

  const [activeMovie, setActiveMovie] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [favoriteLoading, setFavoriteLoading] = useState(false);
  const [favoriteError, setFavoriteError] = useState("");

  useEffect(() => {
    let cancelled = false;

    async function initAuthSession() {
      const token = getStoredToken();
      if (!token) {
        if (!cancelled) {
          setAuthStage("gate");
          setCurrentUser(null);
          setAuthToken("");
        }
        return;
      }

      try {
        const me = await apiRequest("/auth/me", { token });
        if (!cancelled) {
          setAuthToken(token);
          setCurrentUser(me);
          setAuthStage("user");
        }
      } catch {
        if (!cancelled) {
          clearStoredToken();
          setAuthToken("");
          setCurrentUser(null);
          setAuthStage("gate");
          setAuthError("Session invalide ou expiree. Reconnecte-toi.");
        }
      }
    }

    initAuthSession();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function loadHome() {
      if (authStage !== "guest" && authStage !== "user") return;

      setLoading(true);
      setError("");
      setFavoritesInitError("");

      try {
        const [t, p, r] = await Promise.all([
          apiRequest("/movies/trending", { params: { limit: 14 } }),
          apiRequest("/movies/popular", { params: { limit: 14 } }),
          apiRequest("/movies/top-rated", { params: { limit: 14 } }),
        ]);

        if (!cancelled) {
          setTrending(t);
          setPopular(p);
          setTopRated(r);
        }

        if (authStage === "guest") {
          if (!cancelled) {
            setFavoriteIds(new Set());
            setCurrentUser(null);
          }
          return;
        }

        try {
          const favorites = await apiRequest("/favorites/me", { token: authToken });
          if (!cancelled) {
            setFavoriteIds(toFavoriteIdSet(favorites));
          }
        } catch (e) {
          if (!cancelled) {
            setFavoritesInitError(e.message || "Impossible de charger les favoris");
          }
        }
      } catch (e) {
        if (!cancelled) setError(e.message || "Erreur chargement home");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    loadHome();
    return () => {
      cancelled = true;
    };
  }, [authStage, authToken]);

  const heroMovie = useMemo(() => {
    return trending[0] || popular[0] || topRated[0] || null;
  }, [trending, popular, topRated]);

  async function handleAuthSubmit(event) {
    event.preventDefault();
    setAuthSubmitLoading(true);
    setAuthError("");

    try {
      const path = authMode === "login" ? "/auth/login" : "/auth/register";
      const payload = { email: authEmail.trim(), password: authPassword };
      const result = await apiRequest(path, { method: "POST", body: payload });

      setStoredToken(result.access_token);
      setAuthToken(result.access_token);
      setCurrentUser(result.user);
      setFavoriteIds(new Set());
      setAuthStage("user");
      setAuthEmail("");
      setAuthPassword("");
      setFavoriteError("");
    } catch (e) {
      setAuthError(e.message || "Impossible de se connecter");
    } finally {
      setAuthSubmitLoading(false);
    }
  }

  function handleGuestAccess() {
    setAuthStage("guest");
    setAuthError("");
    setFavoriteError("");
    setFavoriteIds(new Set());
    setCurrentUser(null);
  }

  async function handleLogout() {
    if (authStage === "user" && authToken) {
      try {
        await apiRequest("/auth/logout", { method: "POST", token: authToken });
      } catch {
        // ignore backend logout errors, local logout still applies
      }
    }

    clearStoredToken();
    setAuthToken("");
    setCurrentUser(null);
    setFavoriteIds(new Set());
    setAuthStage("gate");
    setSearchOpen(false);
    setActiveMovie(null);
  }

  async function handleSearchSubmit(event) {
    event.preventDefault();
    const query = searchQuery.trim();

    setSearchOpen(true);
    setSearchError("");
    setSearchResults([]);

    if (!query) {
      setSearchError("Le champ recherche est vide.");
      return;
    }

    setSearchLoading(true);
    try {
      const results = await apiRequest("/movies/search", {
        params: { q: query, limit: 30 },
      });
      setSearchResults(results);
    } catch (e) {
      setSearchError(e.message || "Erreur recherche");
    } finally {
      setSearchLoading(false);
    }
  }

  function handleCloseSearch() {
    setSearchOpen(false);
    setSearchResults([]);
    setSearchError("");
    setSearchQuery("");
  }

  async function openMovie(movie) {
    if (!movie) return;
    setActiveMovie(movie);
    setDetailLoading(true);
    setFavoriteError("");

    if (!movie.id) {
      setDetailLoading(false);
      return;
    }

    try {
      const details = await apiRequest(`/movies/${movie.id}`);
      setActiveMovie((prev) => (prev && prev.id === movie.id ? details : prev));
    } catch {
      // Keep current data if details call fails.
    } finally {
      setDetailLoading(false);
    }
  }

  function closeMovie() {
    setActiveMovie(null);
    setDetailLoading(false);
    setFavoriteLoading(false);
    setFavoriteError("");
  }

  async function toggleFavorite(movie) {
    if (!movie?.id || favoriteLoading) return;

    if (authStage !== "user" || !authToken) {
      setFavoriteError("Connecte-toi pour gerer tes favoris.");
      return;
    }

    const isFavorite = favoriteIds.has(movie.id);
    setFavoriteLoading(true);
    setFavoriteError("");

    try {
      if (isFavorite) {
        await apiRequest(`/favorites/me/${movie.id}`, {
          method: "DELETE",
          token: authToken,
        });

        setFavoriteIds((prev) => {
          const next = new Set(prev);
          next.delete(movie.id);
          return next;
        });
        return;
      }

      await apiRequest("/favorites/me", {
        method: "POST",
        token: authToken,
        body: {
          tmdb_movie_id: movie.id,
          title: movie.title,
          poster: movie.poster || null,
          year: movie.year || null,
          rating: movie.rating ?? null,
        },
      });

      setFavoriteIds((prev) => {
        const next = new Set(prev);
        next.add(movie.id);
        return next;
      });
    } catch (e) {
      setFavoriteError(e.message || "Erreur favoris");
    } finally {
      setFavoriteLoading(false);
    }
  }

  if (authStage === "checking") {
    return (
      <div className="auth-screen">
        <div className="auth-card">
          <h1 className="auth-brand">Sorflix</h1>
          <p className="auth-subtitle">Checking session...</p>
        </div>
      </div>
    );
  }

  if (authStage === "gate") {
    return (
      <div className="auth-screen">
        <div className="auth-card">
          <h1 className="auth-brand">Sorflix</h1>
          <p className="auth-subtitle">Sign in to sync favorites, or continue as guest.</p>

          <div className="auth-tabs">
            <button
              type="button"
              className={`auth-tab ${authMode === "login" ? "auth-tab-active" : ""}`}
              onClick={() => setAuthMode("login")}
            >
              Login
            </button>
            <button
              type="button"
              className={`auth-tab ${authMode === "register" ? "auth-tab-active" : ""}`}
              onClick={() => setAuthMode("register")}
            >
              Register
            </button>
          </div>

          <form className="auth-form" onSubmit={handleAuthSubmit}>
            <input
              className="auth-input"
              type="email"
              placeholder="email"
              value={authEmail}
              onChange={(e) => setAuthEmail(e.target.value)}
              required
            />
            <input
              className="auth-input"
              type="password"
              placeholder="password"
              value={authPassword}
              onChange={(e) => setAuthPassword(e.target.value)}
              minLength={authMode === "register" ? 8 : 1}
              required
            />
            <button className="auth-submit" type="submit" disabled={authSubmitLoading}>
              {authSubmitLoading
                ? "Please wait..."
                : authMode === "login"
                  ? "Login"
                  : "Create account"}
            </button>
          </form>

          {authError ? <p className="status status-error">{authError}</p> : null}

          <button className="auth-guest" type="button" onClick={handleGuestAccess}>
            Continue as guest
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="app">
      <nav className="nav">
        <div className="nav-left">
          <span className="brand">Sorflix</span>
          <span className="tag">Catalogue & API TMDB - Mohammed Zhairi</span>
        </div>

        <div className="nav-actions">
          <form className="search-form" onSubmit={handleSearchSubmit}>
            <input
              className="search-input"
              type="search"
              placeholder="Rechercher un film"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
            <button className="search-button" type="submit">
              Search
            </button>
          </form>

          {authStage === "user" ? (
            <button className="btn btn-ghost" type="button" onClick={handleLogout}>
              Logout
            </button>
          ) : null}
        </div>
      </nav>

      {heroMovie ? (
        <header
          className="hero"
          style={{
            backgroundImage: heroMovie.poster
              ? `linear-gradient(180deg, rgba(8,8,8,0.2) 0%, rgba(8,8,8,0.9) 65%, #0b0b0b 100%), url(${heroMovie.poster})`
              : undefined,
          }}
        >
          <div className="hero-content">
            <h1>{heroMovie.title}</h1>
            <p className="hero-meta">
              <span>{heroMovie.year || ""}</span>
              <span className="dot">•</span>
              <span>
                {heroMovie.rating != null ? heroMovie.rating.toFixed(1) : "N/A"}
              </span>
            </p>
            <p className="hero-overview">
              {heroMovie.overview ||
                "Selection trending pour lancer votre experience Sorflix."}
            </p>
            <div className="hero-actions">
              <button className="btn btn-primary" type="button">
                Play (MVP)
              </button>
              <button
                className="btn btn-ghost"
                type="button"
                onClick={() => openMovie(heroMovie)}
              >
                More info
              </button>
            </div>
          </div>
        </header>
      ) : null}

      <main className="main">
        {loading ? <p className="status">Chargement...</p> : null}
        {error ? <p className="status status-error">{error}</p> : null}
        {authStage === "guest" ? <p className="status">Guest mode (favoris desactives)</p> : null}
        {currentUser ? <p className="status">Session active: {currentUser.email}</p> : null}
        {favoritesInitError ? <p className="status status-error">{favoritesInitError}</p> : null}

        <MovieRow
          title="Trending"
          movies={trending}
          onOpen={openMovie}
          favoriteIds={favoriteIds}
        />
        <MovieRow
          title="Popular"
          movies={popular}
          onOpen={openMovie}
          favoriteIds={favoriteIds}
        />
        <MovieRow
          title="Top Rated"
          movies={topRated}
          onOpen={openMovie}
          favoriteIds={favoriteIds}
        />
      </main>

      {searchOpen ? (
        <section className="search-overlay">
          <div className="search-toolbar">
            <div>
              <h2>Recherche</h2>
              <p className="search-subtitle">
                {searchQuery ? `Resultats pour "${searchQuery}"` : ""}
              </p>
            </div>
            <button className="btn btn-ghost" onClick={handleCloseSearch}>
              Fermer
            </button>
          </div>

          <div className="search-body">
            {searchLoading ? <p className="status">Recherche...</p> : null}
            {searchError ? (
              <p className="status status-error">{searchError}</p>
            ) : null}

            {!searchLoading && !searchError && searchResults.length === 0 ? (
              <p className="status">Aucun resultat pour le moment.</p>
            ) : null}

            {searchResults.length > 0 ? (
              <MovieGrid
                movies={searchResults}
                onOpen={openMovie}
                favoriteIds={favoriteIds}
              />
            ) : null}
          </div>
        </section>
      ) : null}

      <MovieModal
        movie={activeMovie}
        loading={detailLoading}
        onClose={closeMovie}
        isFavorite={Boolean(activeMovie?.id && favoriteIds.has(activeMovie.id))}
        favoriteLoading={favoriteLoading}
        favoriteError={favoriteError}
        onToggleFavorite={toggleFavorite}
        canManageFavorites={authStage === "user"}
      />
    </div>
  );
}
