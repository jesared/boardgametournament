import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { DeleteSessionDialog } from "@/components/delete-session-dialog";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatDate } from "@/lib/format";
import { prisma } from "@/lib/prisma";
import { importSessionJson } from "@/app/actions";

export default async function DashboardPage() {
  const sessions = await prisma.tournamentSession.findMany({
    orderBy: { date: "desc" },
  });

  return (
    <div className="space-y-6">
      <section className="flex flex-wrap items-center justify-between gap-4">
        <div className="space-y-2">
          <Badge className="border-secondary/60 bg-secondary/30 text-foreground ring-1 ring-secondary/40">
            Tableau de bord
          </Badge>
          <h1 className="text-3xl font-semibold tracking-tight">
            Sessions en cours
          </h1>
          <p className="text-sm text-muted-foreground">
            Acces rapide a toutes les sessions et tournois.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2 self-start lg:sticky lg:top-6 lg:z-10">
          <Link
            href="#sessions-list"
            className="inline-flex h-9 items-center justify-center rounded-lg border border-border px-3 text-xs font-semibold text-foreground/80 transition-colors duration-300 hover:bg-muted hover:text-foreground"
          >
            Voir les sessions
          </Link>
          <Link
            href="/sessions/new"
            className="inline-flex h-11 items-center justify-center rounded-lg bg-primary px-5 text-base font-semibold text-primary-foreground transition-colors duration-300 hover:bg-primary/90"
          >
            Creer une session
          </Link>
        </div>
      </section>

      <Card id="sessions-list">
        <CardHeader>
          <CardTitle>Liste des sessions</CardTitle>
          <CardDescription>Selectionne une session a ouvrir.</CardDescription>
        </CardHeader>
        <CardContent>
          {sessions.length === 0 ? (
            <div className="rounded-xl border border-border bg-muted px-4 py-3 text-sm text-muted-foreground">
              Aucune session pour le moment.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table className="min-w-[560px]">
                <TableHeader>
                  <TableRow>
                    <TableHead>Session</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sessions.map((session) => (
                    <TableRow key={session.id}>
                      <TableCell className="font-semibold">
                        {session.name}
                      </TableCell>
                      <TableCell>{formatDate(session.date)}</TableCell>
                      <TableCell>
                        <div className="flex flex-wrap items-center gap-2">
                          <Link
                            href={`/sessions/${session.id}`}
                            className="text-sm text-foreground/80 transition-colors duration-300 hover:text-foreground hover:underline decoration-accent/70 underline-offset-4"
                          >
                            Ouvrir &rarr;
                          </Link>
                          <DeleteSessionDialog
                            sessionId={session.id}
                            sessionName={session.name}
                          />
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Principe du site</CardTitle>
          <CardDescription>Le parcours type en 6 etapes.</CardDescription>
        </CardHeader>
        <CardContent>
          <ol className="space-y-3 text-sm">
            <li className="rounded-lg border border-border bg-muted px-4 py-3">
              <p className="font-semibold">1. Creer une session</p>
              <p className="text-xs text-muted-foreground">
                Nom et date de la journee de jeu.
              </p>
            </li>
            <li className="rounded-lg border border-border bg-muted px-4 py-3">
              <p className="font-semibold">2. Ajouter des joueurs</p>
              <p className="text-xs text-muted-foreground">
                Ajout manuel ou import CSV.
              </p>
            </li>
            <li className="rounded-lg border border-border bg-muted px-4 py-3">
              <p className="font-semibold">3. Ajouter des jeux</p>
              <p className="text-xs text-muted-foreground">
                Min, max, duree et type de scoring.
              </p>
            </li>
            <li className="rounded-lg border border-border bg-muted px-4 py-3">
              <p className="font-semibold">4. Creer des manches</p>
              <p className="text-xs text-muted-foreground">
                Tables, affectations et contraintes.
              </p>
            </li>
            <li className="rounded-lg border border-border bg-muted px-4 py-3">
              <p className="font-semibold">5. Saisir les resultats</p>
              <p className="text-xs text-muted-foreground">
                Classement par table ou scores bruts.
              </p>
            </li>
            <li className="rounded-lg border border-border bg-muted px-4 py-3">
              <p className="font-semibold">6. Suivre le classement</p>
              <p className="text-xs text-muted-foreground">
                Live + export CSV/PDF.
              </p>
            </li>
          </ol>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Importer une session (JSON)</CardTitle>
          <CardDescription>
            Permet de recreer une session avec joueurs, jeux, manches et tables.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form action={importSessionJson} className="flex flex-wrap items-end gap-3">
            <div className="space-y-2">
              <Label htmlFor="session-json">Fichier JSON</Label>
              <Input id="session-json" name="file" type="file" accept=".json" />
            </div>
            <button className="h-9 rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground transition-colors duration-300 hover:bg-primary/90">
              Importer
            </button>
          </form>
          <p className="mt-2 text-xs text-muted-foreground">
            Le fichier doit contenir la session, les joueurs, les jeux et les manches.
          </p>
          <details className="mt-3 rounded-lg border border-border bg-muted px-4 py-3 text-xs text-muted-foreground">
            <summary className="cursor-pointer text-xs font-semibold text-foreground/80">
              Voir un exemple de JSON
            </summary>
            <pre className="mt-3 whitespace-pre-wrap break-words text-[11px] text-foreground/80">
{`{
  "session": { "name": "Tournoi du samedi", "date": "2026-03-26" },
  "players": [{ "name": "Alice" }, { "name": "Bob" }],
  "games": [
    { "name": "Azul", "minPlayers": 2, "maxPlayers": 4, "duration": 40, "scoringType": "raw" }
  ],
  "rounds": [
    {
      "order": 1,
      "tables": [
        {
          "gameName": "Azul",
          "participants": [
            { "playerName": "Alice", "position": 1, "score": 45 },
            { "playerName": "Bob", "position": 2, "score": 38 }
          ]
        }
      ]
    }
  ]
}`}
            </pre>
          </details>
        </CardContent>
      </Card>
    </div>
  );
}

