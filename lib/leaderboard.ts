import type { Game, Player, Round, Table, TableParticipant } from "@prisma/client";

import { pointsForPosition } from "@/lib/scoring";

type ParticipantWithTable = TableParticipant & {
  table: Table & {
    game: Game;
    round: Round;
  };
};

export type LeaderboardEntry = {
  playerId: string;
  name: string;
  totalPoints: number;
  wins: number;
  averagePosition: number | null;
  playedTables: number;
};

export function buildLeaderboard(
  players: Player[],
  participants: ParticipantWithTable[],
): LeaderboardEntry[] {
  const map = new Map<string, LeaderboardEntry>();

  for (const player of players) {
    map.set(player.id, {
      playerId: player.id,
      name: player.name,
      totalPoints: 0,
      wins: 0,
      averagePosition: null,
      playedTables: 0,
    });
  }

  const positionAccumulator = new Map<string, { sum: number; count: number }>();

  for (const participant of participants) {
    const entry = map.get(participant.playerId);
    if (!entry) continue;

    let points = 0;
    if (participant.table.game.scoringType === "raw") {
      points = participant.score ?? 0;
    } else {
      points = pointsForPosition(participant.position);
    }

    entry.totalPoints += points;
    entry.playedTables += 1;
    if (participant.position === 1) {
      entry.wins += 1;
    }

    if (participant.position !== null && participant.position !== undefined) {
      const current = positionAccumulator.get(participant.playerId) ?? {
        sum: 0,
        count: 0,
      };
      current.sum += participant.position;
      current.count += 1;
      positionAccumulator.set(participant.playerId, current);
    }
  }

  for (const [playerId, accumulator] of positionAccumulator.entries()) {
    const entry = map.get(playerId);
    if (!entry) continue;
    entry.averagePosition = accumulator.sum / accumulator.count;
  }

  return Array.from(map.values()).sort((a, b) => {
    if (b.totalPoints !== a.totalPoints) {
      return b.totalPoints - a.totalPoints;
    }
    if (b.wins !== a.wins) {
      return b.wins - a.wins;
    }
    const aPos = a.averagePosition ?? Number.POSITIVE_INFINITY;
    const bPos = b.averagePosition ?? Number.POSITIVE_INFINITY;
    return aPos - bPos;
  });
}
