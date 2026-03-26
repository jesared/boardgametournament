import { SessionCreateForm } from "@/components/session-create-form";
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

      <SessionCreateForm templates={sessionTemplates} />
    </div>
  );
}
