const BGA_BASE_URL = "https://api.boardgameatlas.com/api";

type BgaGame = {
  id: string;
  name: string;
  year_published?: number;
  min_players?: number;
  max_players?: number;
  min_playtime?: number;
  max_playtime?: number;
};

async function fetchJson(url: string) {
  const response = await fetch(url, { cache: "no-store" });
  if (!response.ok) {
    throw new Error(`BGA error ${response.status}`);
  }
  return response.json();
}

export type BgaSearchResult = {
  id: string;
  name: string;
  year?: number | null;
};

export async function searchBoardGameAtlas(
  query: string,
  clientId: string,
): Promise<BgaSearchResult[]> {
  const url = `${BGA_BASE_URL}/search?client_id=${encodeURIComponent(
    clientId,
  )}&name=${encodeURIComponent(query)}&order_by=popularity&limit=10`;
  const data = (await fetchJson(url)) as { games?: BgaGame[] };
  const games = data.games ?? [];
  return games.map((game) => ({
    id: game.id,
    name: game.name,
    year: game.year_published ?? null,
  }));
}

export type BgaGameDetails = {
  id: string;
  name: string;
  minPlayers: number;
  maxPlayers: number;
  playingTime: number;
};

export async function fetchBoardGameAtlasGame(
  id: string,
  clientId: string,
): Promise<BgaGameDetails> {
  const url = `${BGA_BASE_URL}/search?client_id=${encodeURIComponent(
    clientId,
  )}&ids=${encodeURIComponent(id)}`;
  const data = (await fetchJson(url)) as { games?: BgaGame[] };
  const game = data.games?.[0];
  if (!game) {
    throw new Error("Jeu BGA introuvable.");
  }
  const minPlayers = game.min_players ?? 1;
  const maxPlayers = game.max_players ?? minPlayers;
  const maxPlaytime = game.max_playtime ?? game.min_playtime ?? 0;

  return {
    id: game.id,
    name: game.name,
    minPlayers,
    maxPlayers,
    playingTime: maxPlaytime,
  };
}
