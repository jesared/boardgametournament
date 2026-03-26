import { prisma } from "@/lib/prisma";

export async function GET(
  _request: Request,
  context: {
    params: Promise<{ id: string }> | { id: string };
  },
) {
  const params = await context.params;
  const sessionId = params.id;
  const { searchParams } = new URL(_request.url);
  const action = searchParams.get("action") ?? "";
  const entity = searchParams.get("entity") ?? "";

  const session = await prisma.tournamentSession.findUnique({
    where: { id: sessionId },
  });

  if (!session) {
    return new Response("Session introuvable", { status: 404 });
  }

  const logs = await prisma.changeLog.findMany({
    where: {
      sessionId,
      ...(action ? { action } : {}),
      ...(entity ? { entityType: entity } : {}),
    },
    orderBy: { createdAt: "desc" },
    take: 500,
  });

  const header = ["Date", "Action", "Entite", "Message"];
  const rows = logs.map((log) => [
    log.createdAt.toISOString(),
    log.action,
    log.entityType,
    log.message ?? "",
  ]);

  const csv = [header, ...rows]
    .map((row) =>
      row
        .map((cell) => {
          const safe = cell.replace(/"/g, '""');
          return `"${safe}"`;
        })
        .join(","),
    )
    .join("\n");

  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename=\"historique-${session.name}.csv\"`,
    },
  });
}

