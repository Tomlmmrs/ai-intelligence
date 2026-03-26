import Link from "next/link";

export default function NotFound() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <div className="max-w-lg rounded-xl border border-border bg-card p-8 text-center">
        <h1 className="mb-2 text-4xl font-bold text-foreground">404</h1>
        <p className="mb-6 text-sm text-muted-foreground">
          Page not found.
        </p>
        <Link
          href="/"
          className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white hover:bg-accent/90 transition-colors"
        >
          Back to dashboard
        </Link>
      </div>
    </div>
  );
}
