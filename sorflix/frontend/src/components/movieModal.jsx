export default function MovieModal({
  movie,
  loading,
  onClose,
  isFavorite,
  favoriteLoading,
  favoriteError,
  onToggleFavorite,
  canManageFavorites,
}) {
  if (!movie) return null;

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <button className="modal-close" onClick={onClose} type="button">
          ×
        </button>

        <div className="modal-media">
          {movie.poster ? (
            <img src={movie.poster} alt={movie.title} />
          ) : (
            <div className="modal-fallback">No poster</div>
          )}
        </div>

        <div className="modal-content">
          <div className="modal-header">
            <h3>{movie.title}</h3>
            {loading ? <span className="chip">Loading...</span> : null}
          </div>

          <p className="modal-meta">
            <span>{movie.year || "N/A"}</span>
            <span className="dot">•</span>
            <span>{movie.rating != null ? movie.rating.toFixed(1) : "N/A"}</span>
          </p>

          <p className="modal-overview">
            {movie.overview || "Aucun synopsis disponible."}
          </p>

          {favoriteError ? <p className="status status-error">{favoriteError}</p> : null}
          {!canManageFavorites ? (
            <p className="status">Login required to manage favorites.</p>
          ) : null}

          <div className="modal-actions">
            <button className="modal-btn modal-btn-primary" type="button">
              Play
            </button>
            {canManageFavorites ? (
              <button
                className={`modal-btn ${isFavorite ? "modal-btn-danger" : "modal-btn-ghost"}`}
                type="button"
                onClick={() => onToggleFavorite(movie)}
                disabled={favoriteLoading}
              >
                {favoriteLoading
                  ? "Saving..."
                  : isFavorite
                    ? "Remove from favorites"
                    : "Add to favorites"}
              </button>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}
