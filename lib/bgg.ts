const BGG_BASE_URLS = [
  "https://boardgamegeek.com/xmlapi2",
  "https://api.geekdo.com/xmlapi2",
];

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
  let lastError: Error | null = null;
  for (const base of BGG_BASE_URLS) {
    for (let attempt = 0; attempt < 3; attempt += 1) {
      const response = await fetch(`${base}${path}`, {
        headers: {
          "User-Agent": "BoardGameTournamentManager/1.0",
          Accept: "text/xml,application/xml;q=0.9,*/*;q=0.8",
        },
        cache: "no-store",
      });
      if (response.status === 202) {
        await new Promise((resolve) =>
          setTimeout(resolve, 800 * (attempt + 1)),
        );
        continue;
      }
      if (response.ok) {
        return response.text();
      }
      lastError = new Error(`BGG error ${response.status}`);
      if (response.status === 401 || response.status === 403) {
        break;
      }
    }
  }
  throw lastError ?? new Error("BGG reponse indisponible.");
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
