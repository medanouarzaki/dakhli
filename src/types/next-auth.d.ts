import type { DefaultSession, DefaultJWT } from "next-auth";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      locale: string;
      baseCurrency: string;
    } & DefaultSession["user"];
    // DefaultSession["user"] brings: name?, email?, image?
  }

  interface User {
    locale: string;
    baseCurrency: string;
  }
}

declare module "next-auth/jwt" {
  interface JWT extends DefaultJWT {
    id: string;
    locale: string;
    baseCurrency: string;
    // DefaultJWT brings: name?, email?, picture?, sub?
  }
}
