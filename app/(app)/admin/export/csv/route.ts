import { getServerSession } from "next-auth";

import { authOptions } from "@/auth";
import { buildLeaderboard } from "@/lib/leaderboard";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) {
    return new Response("Unauthorized", { status: 401 });
  }
  if (session.user?.role !== "admin") {
    return new Response("Forbidden", { status: 403 });
  }

  const sessions = await prisma.tournamentSession.findMany({
    orderBy: { createdAt: "desc" },
  });

  const sessionIds = sessions.map((item) => item.id);
  const [players, participants] = await Promise.all([
    prisma.player.findMany({
      where: { sessionId: { in: sessionIds } },
    }),
    prisma.tableParticipant.findMany({
      where: { table: { round: { sessionId: { in: sessionIds } } } },
      include: {
        table: {
          include: {
            game: true,
            round: true,
          },
        },
      },
    }),
  ]);

  const playersBySession = new Map(
    sessionIds.map((id) => [id, [] as typeof players]),
  );
  players.forEach((player) => {
    const list = playersBySession.get(player.sessionId);
    if (list) list.push(player);
  });

  const participantsBySession = new Map(
    sessionIds.map((id) => [id, [] as typeof participants]),
  );
  participants.forEach((participant) => {
    const sessionId = participant.table.round.sessionId;
    const list = participantsBySession.get(sessionId);
    if (list) list.push(participant);
  });

  const lines = [
    [
      "session",
      "date",
      "rang",
      "joueur",
      "points",
      "victoires",
      "position_moyenne",
    ].join(";"),
  ];

  sessions.forEach((sessionItem) => {
    const roster = playersBySession.get(sessionItem.id) ?? [];
    const entries = participantsBySession.get(sessionItem.id) ?? [];
    const leaderboard = buildLeaderboard(roster, entries);

    leaderboard.forEach((entry, index) => {
      lines.push(
        [
          sessionItem.name,
          sessionItem.date.toISOString().slice(0, 10),
          String(index + 1),
          entry.name,
          String(entry.totalPoints),
          String(entry.wins),
          entry.averagePosition ? entry.averagePosition.toFixed(2) : "",
        ]
          .map((value) => `"${value.replace(/"/g, '""')}"`)
          .join(";"),
      );
    });
  });

  return new Response(lines.join("\n"), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": 'attachment; filename="classements-global.csv"',
    },
  });
}
