import { PrismaAdapter } from "@auth/prisma-adapter";
import type { NextAuthOptions } from "next-auth";
import type { Adapter } from "next-auth/adapters";
import CredentialsProvider from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";

export const authOptions: NextAuthOptions = {
  // Cast required: @auth/prisma-adapter v2 bundles its own @auth/core (Auth.js v5)
  // whose Adapter type is structurally incompatible with next-auth v4's Adapter.
  // Runtime behavior is fully compatible — this is a types-only workaround.
  adapter: PrismaAdapter(prisma) as unknown as Adapter,

  session: {
    strategy: "jwt",
    // 30-day sliding window — reasonable for a finance app
    maxAge: 30 * 24 * 60 * 60,
  },

  providers: [
    CredentialsProvider({
      name: "credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          return null;
        }

        const user = await prisma.user.findUnique({
          where: { email: credentials.email },
          select: {
            id: true,
            email: true,
            name: true,
            passwordHash: true,
            locale: true,
            baseCurrency: true,
          },
        });

        // No user found or user has no password (OAuth-only account)
        if (!user?.passwordHash) {
          return null;
        }

        const isValid = await bcrypt.compare(
          credentials.password,
          user.passwordHash
        );

        if (!isValid) {
          return null;
        }

        return {
          id: user.id,
          email: user.email,
          name: user.name ?? null,
          locale: user.locale,
          baseCurrency: user.baseCurrency,
        };
      },
    }),
  ],

  callbacks: {
    // Runs when a JWT is created (sign-in) or updated (subsequent requests).
    // We persist extra fields into the token on sign-in so we never hit
    // the DB on every request.
    async jwt({ token, user }) {
      if (user) {
        // `user` is only defined on the initial sign-in
        token.id = user.id;
        token.locale = user.locale;
        token.baseCurrency = user.baseCurrency;
      }
      return token;
    },

    // Shapes the Session object returned by useSession() / getServerSession().
    // Copies the values from the JWT into the session.
    // Guard on session.user: NextAuth v4 can have edge cases where it is
    // undefined (e.g. adapter returning no user on a database strategy fallback).
    async session({ session, token }) {
      if (token && session.user) {
        session.user.id = token.id;
        session.user.locale = token.locale;
        session.user.baseCurrency = token.baseCurrency;
      }
      return session;
    },
  },

  pages: {
    // These routes will be built in N3. Note: NextAuth appends ?error=...
    // to the signIn URL on failure — the login page (N3) must handle it.
    signIn: "/login",
    error: "/login",
  },

  secret: process.env.NEXTAUTH_SECRET,
};
