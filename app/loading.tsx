export default function Loading() {
  return (
    <main
      id="main"
      className="page-container inner-page"
      aria-busy="true"
      aria-label="Loading apps"
    >
      <div className="skeleton skeleton-title" />
      <div className="skeleton skeleton-text" />
      <div className="featured-grid">
        {[0, 1].map((i) => (
          <div key={i} className="skeleton skeleton-card" />
        ))}
      </div>
      <p role="status" className="sr-only">Loading</p>
    </main>
  );
}
