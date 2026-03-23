import MovieCard from "./movieCard";

export default function MovieRow({ title, movies, onOpen, favoriteIds }) {
  if (!movies || movies.length === 0) return null;

  return (
    <section className="row">
      <div className="row-header">
        <h2>{title}</h2>
        <span className="row-line" />
      </div>
      <div className="row-track" role="list">
        {movies.map((movie) => (
          <MovieCard
            key={movie.id ?? movie.title}
            movie={movie}
            onOpen={onOpen}
            layout="row"
            isFavorite={Boolean(movie.id && favoriteIds?.has(movie.id))}
          />
        ))}
      </div>
    </section>
  );
}
