// Module-level logging to surface import-time errors when Next.js loads this route
console.log('[auth.route] module loaded');
import NextAuth from "next-auth";
import { authOptions } from "@/lib/authOptions";

console.log('[auth.route] creating handler');
const handler = NextAuth(authOptions as any);
console.log('[auth.route] handler created');

export { handler as GET, handler as POST };
