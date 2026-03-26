"use client";

import { signOut } from "next-auth/react";

export function SignOutButton() {
  return (
    <button
      onClick={() => signOut()}
      className="rounded-lg border border-sidebar-border px-3 py-2 text-xs font-semibold text-sidebar-foreground/80 transition-colors duration-300 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
    >
      Se deconnecter
    </button>
  );
}
