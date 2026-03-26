"use client";

import { useEffect } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { CheckCircle2, AlertTriangle } from "lucide-react";

type ToastKind = "success" | "error";

export function FlashToast() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  const success = searchParams.get("success");
  const error = searchParams.get("error");

  const message = success ?? error;
  const kind: ToastKind | null = success ? "success" : error ? "error" : null;

  useEffect(() => {
    if (!message || !kind) return;

    const timeout = window.setTimeout(() => {
      const params = new URLSearchParams(searchParams.toString());
      params.delete("success");
      params.delete("error");
      const next = params.toString();
      router.replace(next ? `${pathname}?${next}` : pathname, { scroll: false });
    }, 2400);

    return () => window.clearTimeout(timeout);
  }, [message, kind, pathname, router, searchParams]);

  if (!message || !kind) return null;

  return (
    <div
      className="fixed inset-x-4 top-4 z-50 sm:inset-x-auto sm:right-6 sm:top-6"
      role="status"
      aria-live="polite"
    >
      <div
        className={`flex items-start gap-3 rounded-2xl border px-4 py-3 text-sm shadow-lg ${
          kind === "success"
            ? "border-accent/80 bg-accent/85 text-white"
            : "border-destructive/80 bg-destructive/85 text-white"
        }`}
      >
        <span
          className={`mt-0.5 inline-flex size-8 items-center justify-center rounded-full text-white ${
            kind === "success" ? "bg-accent/90" : "bg-destructive/90"
          }`}
        >
          {kind === "success" ? (
            <CheckCircle2 className="size-4" />
          ) : (
            <AlertTriangle className="size-4" />
          )}
        </span>
        <div className="max-w-[320px] space-y-1">
          <p className="text-xs font-semibold uppercase tracking-wide text-white">
            {kind === "success" ? "Succes" : "Erreur"}
          </p>
          <p className="text-sm text-white/90">{message}</p>
        </div>
      </div>
    </div>
  );
}
