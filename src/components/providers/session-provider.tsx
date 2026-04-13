"use client";

import { SessionProvider } from "next-auth/react";

// Thin client wrapper — SessionProvider requires a client boundary
// because it uses React context internally.
export function AuthSessionProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  return <SessionProvider>{children}</SessionProvider>;
}
