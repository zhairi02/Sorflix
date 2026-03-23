import MovieCard from "./movieCard";

export default function MovieGrid({ movies, onOpen, favoriteIds }) {
  return (
    <div className="grid">
      {movies.map((movie) => (
        <MovieCard
          key={movie.id ?? movie.title}
          movie={movie}
          onOpen={onOpen}
          layout="grid"
          isFavorite={Boolean(movie.id && favoriteIds?.has(movie.id))}
        />
      ))}
    </div>
  );
}
