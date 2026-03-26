"use client";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="space-y-4 rounded-2xl border border-destructive/40 bg-destructive/15 p-6 text-foreground">
      <h2 className="text-xl font-semibold">Une erreur est survenue</h2>
      <p className="text-sm text-foreground/80">{error.message}</p>
      <button
        type="button"
        onClick={reset}
        className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition-colors duration-300 hover:bg-primary/90"
      >
        Reessayer
      </button>
    </div>
  );
}
