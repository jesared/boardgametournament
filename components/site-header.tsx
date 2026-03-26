import Link from "next/link";

import { Container } from "@/components/container";

export function SiteHeader() {
  return (
    <header className="border-b border-border bg-background/80 backdrop-blur">
      <Container className="flex h-16 items-center justify-between">
        <Link href="/" className="text-lg font-semibold tracking-tight">
          Board Game Tournament Manager
        </Link>
        <nav className="flex items-center gap-6 text-sm text-muted-foreground">
          <Link href="/" className="transition-colors duration-300 hover:text-foreground">
            Sessions
          </Link>
        </nav>
      </Container>
    </header>
  );
}
