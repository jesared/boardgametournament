import Link from "next/link";
import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";

import { FlashToast } from "@/components/flash-toast";
import { SidebarLink } from "@/components/sidebar-link";
import { SignOutButton } from "@/components/sign-out-button";
import { ThemeToggle } from "@/components/theme-toggle";
import { prisma } from "@/lib/prisma";
import { authOptions } from "@/auth";

export default async function AppLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const session = await getServerSession(authOptions);
  if (!session) {
    redirect("/login");
  }
  const userRole = String(session.user?.role ?? "");
  const isActive = (session.user as { isActive?: boolean } | undefined)?.isActive;
  if (isActive === false) {
    redirect("/unauthorized");
  }
  if (userRole !== "organizer" && userRole !== "admin") {
    redirect("/unauthorized");
  }
  const sessions = await prisma.tournamentSession.findMany({
    orderBy: { createdAt: "desc" },
    take: 5,
  });

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="min-h-screen lg:pl-[260px]">
        <aside className="flex flex-col border-b border-sidebar-border bg-sidebar text-sidebar-foreground shadow-lg shadow-black/20 lg:fixed lg:inset-y-0 lg:left-0 lg:w-[260px] lg:border-b-0 lg:border-r">
          <div className="sticky top-0 z-10 border-b border-sidebar-border bg-sidebar px-6 py-6">
            <div className="space-y-3">
              <Link href="/dashboard" className="text-lg font-semibold">
                Board Game Tournament Manager
              </Link>
              <p className="text-xs text-sidebar-foreground/60">
                Gerez sessions, manches et scoring dans une UI lisible.
              </p>
            </div>

            <nav className="mt-4 space-y-2 text-sm">
              <SidebarLink href="/dashboard">Tableau de bord</SidebarLink>
              <SidebarLink href="/sessions/new">Nouvelle session</SidebarLink>
              {userRole === "admin" ? (
                <SidebarLink href="/admin">Admin</SidebarLink>
              ) : null}
            </nav>

            <div className="mt-4 flex flex-col gap-3">
              <ThemeToggle />
              <SignOutButton />
            </div>
          </div>

          <div className="flex-1 overflow-y-auto px-6 py-6">
            <div className="space-y-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-sidebar-foreground/50">
                Sessions recentes
              </p>
              {sessions.length === 0 ? (
                <p className="text-xs text-sidebar-foreground/50">
                  Aucune session.
                </p>
              ) : (
                <ul className="space-y-2 text-sm">
                  {sessions.map((session) => (
                    <li key={session.id}>
                      <SidebarLink
                        href={`/sessions/${session.id}`}
                        variant="session"
                      >
                        {session.name}
                      </SidebarLink>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </aside>

        <main className="bg-background px-6 py-8">
          <FlashToast />
          {children}
        </main>
      </div>
    </div>
  );
}



