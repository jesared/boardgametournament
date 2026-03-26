import { Container } from "@/components/container";

export function SiteFooter() {
  return (
    <footer className="border-t border-border py-8 text-sm text-muted-foreground">
      <Container className="flex flex-col items-center justify-between gap-4 sm:flex-row">
        <span>
          © {new Date().getFullYear()} Board Game Tournament Manager.
        </span>
        <div className="flex items-center gap-4">
          <span>Designed for fast tournament days.</span>
        </div>
      </Container>
    </footer>
  );
}
