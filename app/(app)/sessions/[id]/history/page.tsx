import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { SessionTabs } from "@/components/session-tabs";
import { SessionTopbar, topbarActionClass } from "@/components/session-topbar";
import { prisma } from "@/lib/prisma";
import { formatDateTime } from "@/lib/format";

export default async function SessionHistoryPage(
  props: PageProps<"/sessions/[id]/history">,
) {
  const { id } = await props.params;
  const searchParams = await props.searchParams;
  const action = typeof searchParams.action === "string" ? searchParams.action : "";
  const entity = typeof searchParams.entity === "string" ? searchParams.entity : "";

  const session = await prisma.tournamentSession.findUnique({
    where: { id },
  });

  if (!session) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-semibold">Session introuvable</h1>
      </div>
    );
  }

  const where = {
    sessionId: id,
    ...(action ? { action } : {}),
    ...(entity ? { entityType: entity } : {}),
  };

  const logs = await prisma.changeLog.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: 200,
  });

  const actionFilters = [
    { value: "", label: "Toutes actions" },
    { value: "create", label: "Creation" },
    { value: "delete", label: "Suppression" },
    { value: "validate", label: "Validation" },
    { value: "auto-validate", label: "Auto validation" },
    { value: "auto-generate", label: "Auto generation" },
    { value: "duplicate", label: "Duplication" },
    { value: "import", label: "Import" },
    { value: "template", label: "Template" },
    { value: "share", label: "Partage" },
  ];

  const entityFilters = [
    { value: "", label: "Toutes entites" },
    { value: "session", label: "Session" },
    { value: "player", label: "Joueur" },
    { value: "game", label: "Jeu" },
    { value: "round", label: "Manche" },
  ];

  const query =
    action || entity
      ? `?${new URLSearchParams({
          ...(action ? { action } : {}),
          ...(entity ? { entity } : {}),
        }).toString()}`
      : "";

  return (
    <div className="space-y-6">
      <SessionTopbar
        title={session.name}
        subtitle="Historique des changements et actions."
        badge="Historique"
        actions={
          <a
            href={`/sessions/${id}/history/export/csv${query}`}
            className={`${topbarActionClass} bg-primary text-primary-foreground hover:bg-primary/90`}
          >
            Export CSV
          </a>
        }
      />

      <SessionTabs sessionId={id} current="history" />

      <Card>
        <CardHeader>
          <CardTitle>Filtres</CardTitle>
          <CardDescription>Affinez par action ou entite.</CardDescription>
        </CardHeader>
        <CardContent>
          <form className="flex flex-wrap items-end gap-3">
            <div className="space-y-2">
              <label className="text-xs font-medium text-muted-foreground">
                Type d action
              </label>
              <select
                name="action"
                defaultValue={action}
                className="h-9 min-w-[180px] rounded-lg border border-input bg-background px-3 text-sm text-foreground shadow-sm"
              >
                {actionFilters.map((item) => (
                  <option key={item.value} value={item.value}>
                    {item.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <label className="text-xs font-medium text-muted-foreground">
                Entite
              </label>
              <select
                name="entity"
                defaultValue={entity}
                className="h-9 min-w-[180px] rounded-lg border border-input bg-background px-3 text-sm text-foreground shadow-sm"
              >
                {entityFilters.map((item) => (
                  <option key={item.value} value={item.value}>
                    {item.label}
                  </option>
                ))}
              </select>
            </div>
            <button className="h-9 rounded-lg border border-border px-4 text-sm font-semibold text-foreground transition-colors duration-300 hover:bg-muted">
              Appliquer
            </button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Historique recent</CardTitle>
          <CardDescription>Jusqu a 200 actions.</CardDescription>
        </CardHeader>
        <CardContent>
          {logs.length === 0 ? (
            <div className="rounded-xl border border-border bg-muted px-4 py-3 text-sm text-muted-foreground">
              Aucun log pour le moment.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-[640px] w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-xs uppercase tracking-wide text-muted-foreground">
                    <th className="px-3 py-2 text-left">Date</th>
                    <th className="px-3 py-2 text-left">Action</th>
                    <th className="px-3 py-2 text-left">Entite</th>
                    <th className="px-3 py-2 text-left">Details</th>
                  </tr>
                </thead>
                <tbody>
                  {logs.map((log) => (
                    <tr key={log.id} className="border-b border-border/60">
                      <td className="px-3 py-2 text-muted-foreground">
                        {formatDateTime(log.createdAt)}
                      </td>
                      <td className="px-3 py-2 font-semibold">{log.action}</td>
                      <td className="px-3 py-2">{log.entityType}</td>
                      <td className="px-3 py-2 text-muted-foreground">
                        {log.message ?? "-"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

