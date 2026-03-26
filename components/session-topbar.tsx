import Link from "next/link";
import { getServerSession } from "next-auth";

import { Badge } from "@/components/ui/badge";
import { authOptions } from "@/auth";
import { cn } from "@/lib/utils";

export const topbarActionClass =
  "inline-flex h-10 items-center justify-center rounded-lg px-4 text-sm font-semibold transition-colors duration-300";

type SessionTopbarProps = {
  title: string;
  subtitle?: string;
  backHref?: string;
  actions?: React.ReactNode;
  badge?: string;
};

export async function SessionTopbar({
  title,
  subtitle,
  backHref = "/dashboard",
  actions,
  badge = "Session",
}: SessionTopbarProps) {
  const session = await getServerSession(authOptions);
  const role = String(session?.user?.role ?? "viewer").toLowerCase();

  return (
    <div className="flex flex-wrap items-start justify-between gap-4">
      <div className="space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          <Badge className="border-secondary/60 bg-secondary/30 text-foreground ring-1 ring-secondary/40">
            {badge}
          </Badge>
          {role === "admin" ? (
            <Badge className="border-accent/60 bg-accent/30 text-foreground ring-1 ring-accent/40">
              Admin
            </Badge>
          ) : null}
        </div>
        <h1 className="text-3xl font-semibold tracking-tight">{title}</h1>
        {subtitle ? (
          <p className="text-sm text-muted-foreground">{subtitle}</p>
        ) : null}
        <Link
          href={backHref}
          className={cn(
            "text-sm text-foreground/80 transition-colors duration-300",
            "hover:text-foreground hover:underline decoration-accent/70 underline-offset-4",
          )}
        >
          &larr; Retour au tableau de bord
        </Link>
      </div>
      {actions ? (
        <div className="flex flex-wrap items-center gap-2 self-start lg:sticky lg:top-6 lg:z-10">
          {actions}
        </div>
      ) : null}
    </div>
  );
}
