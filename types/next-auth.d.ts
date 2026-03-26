import "next-auth";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      role: "admin" | "organizer" | "viewer";
      isActive?: boolean;
      name?: string | null;
      email?: string | null;
      image?: string | null;
    };
  }

  interface User {
    role?: "admin" | "organizer" | "viewer";
    isActive?: boolean;
  }
}
