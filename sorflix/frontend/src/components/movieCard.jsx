export default function MovieCard({
  movie,
  onOpen,
  layout = "row",
  isFavorite = false,
}) {
  const poster = movie?.poster || "";

  function handleOpen() {
    if (onOpen) onOpen(movie);
  }

  return (
    <article
      className={`movie-card movie-card--${layout}`}
      onClick={handleOpen}
      role="button"
      tabIndex={0}
      aria-label={`Voir les details du film ${movie.title}`}
    >
      <div className="movie-card-media">
        {poster ? (
          <img src={poster} alt={movie.title} loading="lazy" />
        ) : (
          <div className="movie-card-fallback">No poster</div>
        )}

        {isFavorite ? <span className="favorite-badge">Favorite</span> : null}
      </div>

      <div className="movie-card-info">
        <h3>{movie.title}</h3>
        <p>
          <span>{movie.year || "N/A"}</span>
          <span className="dot">•</span>
          <span>{movie.rating != null ? movie.rating.toFixed(1) : "N/A"}</span>
        </p>
      </div>
    </article>
  );
}
