export function Notice({ error, ok }: { error?: string; ok?: string }) {
  if (error) {
    return (
      <p className="notice notice--error" role="alert">
        {error}
      </p>
    );
  }
  if (ok) {
    return (
      <p className="notice notice--ok" role="status">
        {ok}
      </p>
    );
  }
  return null;
}
