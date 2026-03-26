import NextAuth, { type NextAuthOptions } from "next-auth";
import GoogleProvider from "next-auth/providers/google";
import EmailProvider from "next-auth/providers/email";
import { PrismaAdapter } from "@auth/prisma-adapter";

import { prisma } from "@/lib/prisma";

export const authOptions: NextAuthOptions = {
  adapter: PrismaAdapter(prisma),
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID ?? "",
      clientSecret: process.env.GOOGLE_CLIENT_SECRET ?? "",
    }),
    EmailProvider({
      server: process.env.EMAIL_SERVER ?? "",
      from: process.env.EMAIL_FROM ?? "",
    }),
  ],
  pages: {
    signIn: "/login",
  },
  session: {
    strategy: "database",
  },
  callbacks: {
    async signIn({ user }) {
      if (user.email) {
        const existing = await prisma.user.findUnique({
          where: { email: user.email },
          select: { isActive: true },
        });
        if (existing && existing.isActive === false) {
          return false;
        }
      }
      return true;
    },
    async session({ session, user }) {
      if (session.user) {
        session.user.id = user.id;
        const rawRole = (user as { role?: string }).role ?? "organizer";
        const normalizedRole = rawRole.toLowerCase();
        const role =
          normalizedRole === "admin"
            ? "admin"
            : normalizedRole === "viewer"
              ? "viewer"
              : "organizer";
        session.user.role = role as unknown as typeof session.user.role;
        (session.user as { isActive?: boolean }).isActive =
          (user as { isActive?: boolean }).isActive ?? true;
      }
      return session;
    },
  },
  events: {
    async signIn({ user, account }) {
      await prisma.user.update({
        where: { id: user.id },
        data: { lastLoginAt: new Date() },
      });
      await prisma.authLog.create({
        data: {
          userId: user.id,
          action: "sign-in",
          provider: account?.provider ?? null,
        },
      });
    },
    async signOut({ session }) {
      const userId = session?.user?.id;
      if (!userId) return;
      await prisma.authLog.create({
        data: {
          userId,
          action: "sign-out",
        },
      });
    },
  },
};

const handler = NextAuth(authOptions);

export { handler };
