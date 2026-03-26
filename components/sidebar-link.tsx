"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { cn } from "@/lib/utils";

export function SidebarLink({
  href,
  children,
  variant = "nav",
}: {
  href: string;
  children: React.ReactNode;
  variant?: "nav" | "session";
}) {
  const pathname = usePathname();
  const isActive = pathname === href || pathname.startsWith(`${href}/`);

  return (
    <Link
      href={href}
      className={cn(
        "block transition-colors duration-300",
        variant === "nav"
          ? "rounded-lg border border-sidebar-border px-3 py-2"
          : "rounded-md px-2 py-1 text-xs",
        isActive
          ? variant === "nav"
            ? "border-sidebar-primary bg-sidebar-primary text-sidebar-primary-foreground"
            : "bg-sidebar-accent text-sidebar-accent-foreground ring-1 ring-sidebar-ring/40"
          : "hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
      )}
    >
      {children}
    </Link>
  );
}
