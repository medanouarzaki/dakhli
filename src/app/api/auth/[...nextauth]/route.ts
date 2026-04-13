import NextAuth from "next-auth";
import { authOptions } from "@/lib/auth";

// Next.js 14 App Router — export named handlers for GET and POST.
// NextAuth handles all /api/auth/* routes (signin, signout, callback, session…).
const handler = NextAuth(authOptions);

export { handler as GET, handler as POST };
