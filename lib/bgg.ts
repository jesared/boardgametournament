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

function extractAttribute(fragment: string, attribute: string) {
  const match = fragment.match(new RegExp(`${attribute}=\"([^\"]*)\"`));
  return match ? decodeXml(match[1]) : null;
}

async function fetchXml(path: string) {
  const baseUrl =
    process.env.NEXT_PUBLIC_APP_URL ||
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : null) ||
    "http://localhost:3000";
  const url = new URL(`${baseUrl}/api/bgg`);

  if (path.startsWith("/search")) {
    const query = new URLSearchParams(path.split("?")[1] ?? "");
    url.searchParams.set("type", "search");
    url.searchParams.set("query", query.get("query") ?? "");
  } else if (path.startsWith("/thing")) {
    const query = new URLSearchParams(path.split("?")[1] ?? "");
    url.searchParams.set("type", "thing");
    url.searchParams.set("id", query.get("id") ?? "");
  } else {
    throw new Error("BGG path invalide.");
  }

  const response = await fetch(url.toString(), { cache: "no-store" });
  if (!response.ok) {
    throw new Error(`BGG error ${response.status}`);
  }
  return response.text();
}

export type BggSearchResult = {
  id: string;
  name: string;
  year?: string | null;
};

export async function searchBggGames(query: string): Promise<BggSearchResult[]> {
  const xml = await fetchXml(
    `/search?query=${encodeURIComponent(query)}&type=boardgame`,
  );
  const results: BggSearchResult[] = [];
  const itemRegex = /<item[^>]*id="([^"]+)"[^>]*>([\s\S]*?)<\/item>/g;
  let match: RegExpExecArray | null;

  while ((match = itemRegex.exec(xml)) !== null) {
    const id = match[1];
    const body = match[2];
    const name =
      extractAttribute(body, "value") &&
      (body.match(/<name[^>]*type="primary"[^>]*value="([^"]+)"/)?.[1] ??
        body.match(/<name[^>]*value="([^"]+)"/)?.[1]);
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

export type BggGameDetails = {
  id: string;
  name: string;
  minPlayers: number;
  maxPlayers: number;
  playingTime: number;
};

export async function fetchBggGameDetails(id: string): Promise<BggGameDetails> {
  const xml = await fetchXml(
    `/thing?id=${encodeURIComponent(id)}&type=boardgame`,
  );
  const itemMatch = xml.match(/<item[^>]*id="([^"]+)"[^>]*>([\s\S]*?)<\/item>/);
  if (!itemMatch) {
    throw new Error("Jeu BGG introuvable.");
  }
  const body = itemMatch[2];
  const name =
    body.match(/<name[^>]*type="primary"[^>]*value="([^"]+)"/)?.[1] ??
    body.match(/<name[^>]*value="([^"]+)"/)?.[1];
  if (!name) {
    throw new Error("Nom BGG introuvable.");
  }

  const minPlayers = Number(
    body.match(/<minplayers[^>]*value="([^"]+)"/)?.[1] ?? "1",
  );
  const maxPlayers = Number(
    body.match(/<maxplayers[^>]*value="([^"]+)"/)?.[1] ?? "1",
  );
  const playingTime = Number(
    body.match(/<playingtime[^>]*value="([^"]+)"/)?.[1] ??
      body.match(/<maxplaytime[^>]*value="([^"]+)"/)?.[1] ??
      body.match(/<minplaytime[^>]*value="([^"]+)"/)?.[1] ??
      "0",
  );

  return {
    id,
    name: decodeXml(name),
    minPlayers: Number.isNaN(minPlayers) ? 1 : minPlayers,
    maxPlayers: Number.isNaN(maxPlayers) ? 1 : maxPlayers,
    playingTime: Number.isNaN(playingTime) ? 0 : playingTime,
  };
}
