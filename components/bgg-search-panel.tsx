"use client";

import { useEffect, useMemo, useState } from "react";

import { importGameFromBgg } from "@/app/actions";

type BggResult = {
  id: string;
  name: string;
  year?: string | null;
};

const ENTITY_MAP: Record<string, string> = {
  "&amp;": "&",
  "&quot;": "\"",
  "&apos;": "'",
  "&lt;": "<",
  "&gt;": ">",
};

function decodeXml(value: string) {
  return value.replace(/&(amp|quot|apos|lt|gt);/g, (match) => ENTITY_MAP[match] ?? match);
}

function parseResults(xml: string): BggResult[] {
  const results: BggResult[] = [];
  const itemRegex = /<item[^>]*id="([^"]+)"[^>]*>([\s\S]*?)<\/item>/g;
  let match: RegExpExecArray | null;

  while ((match = itemRegex.exec(xml)) !== null) {
    const id = match[1];
    const body = match[2];
    const name =
      (body.match(/<name[^>]*type="primary"[^>]*value="([^"]+)"/)?.[1] ??
        body.match(/<name[^>]*value="([^"]+)"/)?.[1]) ??
      "";
    if (!name) continue;
    const year =
      body.match(/<yearpublished[^>]*value="([^"]+)"/)?.[1] ?? null;
    results.push({
      id,
      name: decodeXml(name),
      year: year ? decodeXml(year) : null,
    });
  }

  return results.slice(0, 10);
}

export function BggSearchPanel() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<BggResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const trimmed = useMemo(() => query.trim(), [query]);

  useEffect(() => {
    if (trimmed.length < 2) {
      setResults([]);
      setError(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);
    const handle = setTimeout(async () => {
      try {
        const response = await fetch(
          `/api/bgg?type=search&query=${encodeURIComponent(trimmed)}`,
        );
        if (!response.ok) {
          throw new Error(`BGG error ${response.status}`);
        }
        const xml = await response.text();
        setResults(parseResults(xml));
      } catch (err) {
        setError(err instanceof Error ? err.message : "BGG indisponible.");
        setResults([]);
      } finally {
        setLoading(false);
      }
    }, 350);

    return () => clearTimeout(handle);
  }, [trimmed]);

  return (
    <div className="space-y-4">
      <div className="min-w-[220px] space-y-2">
        <label className="text-xs font-medium text-muted-foreground">
          Recherche BGG
        </label>
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Ex: Azul, Terraforming Mars"
          className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm text-foreground shadow-sm outline-none transition focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/30"
        />
      </div>

      {trimmed.length < 2 ? (
        <p className="text-sm text-muted-foreground">
          Entrez au moins 2 caracteres pour lancer une recherche.
        </p>
      ) : loading ? (
        <p className="text-sm text-muted-foreground">Recherche en cours...</p>
      ) : error ? (
        <p className="text-sm text-destructive">{error}. Reessayez plus tard.</p>
      ) : results.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Aucun resultat BGG pour “{trimmed}”.
        </p>
      ) : (
        <div className="space-y-2">
          {results.map((result) => (
            <div
              key={result.id}
              className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border bg-muted px-4 py-3 text-sm"
            >
              <div>
                <p className="font-semibold">
                  {result.name} {result.year ? `(${result.year})` : ""}
                </p>
                <p className="text-xs text-muted-foreground">BGG #{result.id}</p>
              </div>
              <form action={importGameFromBgg}>
                <input type="hidden" name="bggId" value={result.id} />
                <button
                  type="submit"
                  className="rounded-lg bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground transition-colors duration-300 hover:bg-primary/90"
                >
                  Importer
                </button>
              </form>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
