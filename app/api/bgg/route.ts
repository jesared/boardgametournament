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

export const runtime = "edge";

const CACHE_SECONDS = 60 * 60; // 1h

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
      lastError = new Error(`BGG error ${response.status}`);
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

  const xml = await fetchXml(path);
  await setCached(cacheKey, xml);

  return new NextResponse(xml, {
    headers: {
      "Content-Type": "text/xml; charset=utf-8",
      "Cache-Control": "s-maxage=3600, stale-while-revalidate=86400",
    },
  });
}
