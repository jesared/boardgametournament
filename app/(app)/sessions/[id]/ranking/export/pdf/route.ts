import PDFDocument from "pdfkit";

import { buildLeaderboard } from "@/lib/leaderboard";
import { prisma } from "@/lib/prisma";

function renderPdf(leaderboard: ReturnType<typeof buildLeaderboard>, title: string) {
  const doc = new PDFDocument({ margin: 48 });
  const chunks: Buffer[] = [];

  doc.on("data", (chunk) => chunks.push(chunk));

  doc.fontSize(20).text(title, { align: "left" });
  doc.moveDown(0.5);
  doc.fontSize(12).fillColor("#444").text("Classement general");
  doc.moveDown(1);

  const colX = [48, 90, 280, 360, 430];
  doc.fontSize(11).fillColor("#111");
  doc.text("#", colX[0], doc.y);
  doc.text("Joueur", colX[1], doc.y);
  doc.text("Points", colX[2], doc.y);
  doc.text("Victoires", colX[3], doc.y);
  doc.text("Pos. moy.", colX[4], doc.y);
  doc.moveDown(0.6);

  doc.fontSize(10).fillColor("#333");
  leaderboard.forEach((entry, index) => {
    doc.text(String(index + 1), colX[0], doc.y);
    doc.text(entry.name, colX[1], doc.y);
    doc.text(String(entry.totalPoints), colX[2], doc.y);
    doc.text(String(entry.wins), colX[3], doc.y);
    doc.text(
      entry.averagePosition ? entry.averagePosition.toFixed(2) : "-",
      colX[4],
      doc.y,
    );
    doc.moveDown(0.4);
  });

  doc.end();
  return new Promise<Buffer>((resolve) => {
    doc.on("end", () => resolve(Buffer.concat(chunks)));
  });
}

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> | { id: string } },
) {
  const params = await context.params;
  const sessionId = params.id;

  const [session, players, participants] = await Promise.all([
    prisma.tournamentSession.findUnique({ where: { id: sessionId } }),
    prisma.player.findMany({ where: { sessionId } }),
    prisma.tableParticipant.findMany({
      where: { table: { round: { sessionId } } },
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

  if (!session) {
    return new Response("Session introuvable", { status: 404 });
  }

  const leaderboard = buildLeaderboard(players, participants);
  const buffer = await renderPdf(leaderboard, session.name);

  return new Response(buffer, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename=\"classement-${session.name}.pdf\"`,
    },
  });
}

