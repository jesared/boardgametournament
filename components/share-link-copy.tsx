"use client";

import { useState } from "react";

type ShareLinkCopyProps = {
  url: string;
};

export function ShareLinkCopy({ url }: ShareLinkCopyProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  };

  return (
    <button
      type="button"
      onClick={handleCopy}
      className="h-9 rounded-lg border border-border px-4 text-xs font-semibold text-foreground transition-colors duration-300 hover:bg-muted"
      aria-live="polite"
    >
      {copied ? "Copie" : "Copier"}
    </button>
  );
}
