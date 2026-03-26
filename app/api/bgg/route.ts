import { NextResponse } from "next/server";
import { Redis } from "@upstash/redis";

const BGG_BASE_URLS = [
  "https://boardgamegeek.com/xmlapi2",
  "https://api.geekdo.com/xmlapi2",
];

const redis =
  process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN
    ? new Redis({
        url: process.env.UPSTASH_REDIS_REST_URL,
        token: process.env.UPSTASH_REDIS_REST_TOKEN,
      })
    : null;

export const runtime = "nodejs";

const CACHE_SECONDS = 60 * 60; // 1h
const LOCAL_CACHE_MS = 10 * 60 * 1000; // 10min fallback in-memory

type LocalCacheEntry = {
  value: string;
  expiresAt: number;
};

const localCache =
  (globalThis as typeof globalThis & {
    __bggLocalCache?: Map<string, LocalCacheEntry>;
  }).__bggLocalCache ?? new Map<string, LocalCacheEntry>();

(globalThis as typeof globalThis & { __bggLocalCache?: typeof localCache }).__bggLocalCache =
  localCache;

async function sleep(ms: number) {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchXml(path: string) {
  let lastError: Error | null = null;
  for (const base of BGG_BASE_URLS) {
    for (let attempt = 0; attempt < 3; attempt += 1) {
      const response = await fetch(`${base}${path}`, {
        headers: {
          "User-Agent": "BoardGameTournamentManager/1.0",
          Accept: "text/xml,application/xml;q=0.9,*/*;q=0.8",
          "Accept-Language": "fr-FR,fr;q=0.8,en;q=0.6",
        },
        cache: "no-store",
      });
      if (response.status === 202) {
        await sleep(800 * (attempt + 1));
        continue;
      }
      if (response.ok) {
        return response.text();
      }
      const error = new Error(`BGG error ${response.status}`);
      (error as Error & { status?: number }).status = response.status;
      lastError = error;
      if (response.status === 401 || response.status === 403) {
        break;
      }
    }
  }
  throw lastError ?? new Error("BGG reponse indisponible.");
}

async function getCached(key: string) {
  if (!redis) return null;
  return (await redis.get<string>(key)) ?? null;
}

async function setCached(key: string, value: string) {
  if (!redis) return;
  await redis.set(key, value, { ex: CACHE_SECONDS });
}

function getLocalCached(key: string) {
  const entry = localCache.get(key);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    localCache.delete(key);
    return null;
  }
  return entry.value;
}

function setLocalCached(key: string, value: string) {
  localCache.set(key, { value, expiresAt: Date.now() + LOCAL_CACHE_MS });
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const type = searchParams.get("type");
  const query = searchParams.get("query");
  const id = searchParams.get("id");

  if (!type) {
    return NextResponse.json({ error: "type manquant" }, { status: 400 });
  }

  let path = "";
  let cacheKey = "";
  if (type === "search" && query) {
    path = `/search?query=${encodeURIComponent(query)}&type=boardgame`;
    cacheKey = `bgg:search:${query.toLowerCase()}`;
  } else if (type === "thing" && id) {
    path = `/thing?id=${encodeURIComponent(id)}&type=boardgame`;
    cacheKey = `bgg:thing:${id}`;
  } else {
    return NextResponse.json({ error: "params invalides" }, { status: 400 });
  }

  const cached = await getCached(cacheKey);
  if (cached) {
    return new NextResponse(cached, {
      headers: {
        "Content-Type": "text/xml; charset=utf-8",
        "Cache-Control": "s-maxage=3600, stale-while-revalidate=86400",
      },
    });
  }

  const localCached = getLocalCached(cacheKey);
  if (localCached) {
    return new NextResponse(localCached, {
      headers: {
        "Content-Type": "text/xml; charset=utf-8",
        "Cache-Control": "s-maxage=600, stale-while-revalidate=3600",
      },
    });
  }

  let xml: string;
  try {
    xml = await fetchXml(path);
  } catch (error) {
    const status = (error as { status?: number }).status;
    if ((status === 401 || status === 403) && localCached) {
      return new NextResponse(localCached, {
        headers: {
          "Content-Type": "text/xml; charset=utf-8",
          "Cache-Control": "s-maxage=600, stale-while-revalidate=3600",
        },
      });
    }
    throw error;
  }

  setLocalCached(cacheKey, xml);
  await setCached(cacheKey, xml);

  return new NextResponse(xml, {
    headers: {
      "Content-Type": "text/xml; charset=utf-8",
      "Cache-Control": "s-maxage=3600, stale-while-revalidate=86400",
    },
  });
}
