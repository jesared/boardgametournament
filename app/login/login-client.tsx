"use client";

import { useMemo, useState } from "react";
import { signIn } from "next-auth/react";
import { useSearchParams } from "next/navigation";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function LoginClient() {
  const [email, setEmail] = useState("");
  const searchParams = useSearchParams();
  const callbackUrl = useMemo(() => {
    const raw = searchParams.get("callbackUrl");
    if (!raw) {
      return "/dashboard";
    }
    try {
      const url = new URL(raw, window.location.origin);
      if (url.pathname === "/login") {
        return "/dashboard";
      }
      return url.toString();
    } catch {
      return raw.includes("/login") ? "/dashboard" : raw;
    }
  }, [searchParams]);
  const callbackUrlWithSuccess = useMemo(() => {
    const successMessage = "Connexion reussie";
    try {
      const url = new URL(callbackUrl, window.location.origin);
      url.searchParams.set("success", successMessage);
      return url.toString();
    } catch {
      const hasQuery = callbackUrl.includes("?");
      const sep = hasQuery ? "&" : "?";
      return `${callbackUrl}${sep}success=${encodeURIComponent(successMessage)}`;
    }
  }, [callbackUrl]);

  return (
    <div className="min-h-screen bg-background px-6 py-12 text-foreground">
      <div className="mx-auto max-w-md space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Connexion organisateur</CardTitle>
            <CardDescription>Connectez-vous pour gerer vos tournois.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <button
              onClick={() => signIn("google", { callbackUrl: callbackUrlWithSuccess })}
              className="h-11 w-full rounded-lg bg-primary text-sm font-semibold text-primary-foreground transition-colors duration-300 hover:bg-primary/90"
            >
              Se connecter avec Google
            </button>

            <div className="rounded-lg border border-border bg-muted px-4 py-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Email
              </p>
              <div className="mt-3 space-y-2">
                <Label htmlFor="login-email">Adresse email</Label>
                <Input
                  id="login-email"
                  type="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder="vous@exemple.com"
                />
                <button
                  onClick={() =>
                    signIn("email", { email, callbackUrl: callbackUrlWithSuccess })
                  }
                  className="h-10 w-full rounded-lg border border-border text-sm font-semibold text-foreground transition-colors duration-300 hover:bg-muted"
                  disabled={!email}
                >
                  Envoyer un lien magique
                </button>
                <p className="text-xs text-muted-foreground">
                  Un lien de connexion sera envoye par email.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
