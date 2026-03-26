import { createSessionWithTemplate } from "@/app/actions";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SessionTopbar } from "@/components/session-topbar";
import { sessionTemplates } from "@/lib/session-templates";

export default function NewSessionPage() {
  return (
    <div className="space-y-6">
      <SessionTopbar
        title="Creer une session"
        subtitle="Definis le nom et la date de ton tournoi."
        badge="Nouvelle session"
      />

      <Card className="max-w-xl">
        <CardHeader>
          <CardTitle>Informations principales</CardTitle>
          <CardDescription>Session, date et participants.</CardDescription>
        </CardHeader>
        <CardContent>
          <form action={createSessionWithTemplate} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="session-name">Nom</Label>
              <Input
                id="session-name"
                name="name"
                placeholder="Tournoi du samedi"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="session-date">Date</Label>
              <Input
                id="session-date"
                name="date"
                type="date"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="session-template">Template (optionnel)</Label>
              <select
                id="session-template"
                name="templateId"
                className="h-9 w-full rounded-lg border border-input bg-background px-3 text-sm text-foreground shadow-sm"
                defaultValue=""
              >
                <option value="">Aucun template</option>
                {sessionTemplates.map((template) => (
                  <option key={template.id} value={template.id}>
                    {template.name}
                  </option>
                ))}
              </select>
              <p className="text-xs text-muted-foreground">
                Les templates prechargent des jeux avec regles.
              </p>
            </div>
            <button className="h-12 w-full rounded-lg bg-primary text-base font-semibold text-primary-foreground transition-colors duration-300 hover:bg-primary/90">
              Creer la session
            </button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
