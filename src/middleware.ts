import { withAuth } from "next-auth/middleware";
import { NextResponse } from "next/server";

// Admin-only routes: everything EXCEPT /wrapped/* and /api/auth/*
const PUBLIC_USER_PATHS = ["/wrapped", "/api/auth"];

export default withAuth(
    function middleware(req) {
        const token = req.nextauth.token;
        const pathname = req.nextUrl.pathname;

        // Allow admin users everywhere
        if (token?.isAdmin) {
            return NextResponse.next();
        }

        // Non-admin users: allow /wrapped/* routes only
        const isAllowed = PUBLIC_USER_PATHS.some(p => pathname.startsWith(p));
        if (isAllowed) {
            return NextResponse.next();
        }

        // Non-admin trying to access admin routes → redirect to their Wrapped page
        const jellyfinUserId = token?.jellyfinUserId as string;
        if (jellyfinUserId) {
            return NextResponse.redirect(new URL(`/wrapped/${jellyfinUserId}`, req.url));
        }

        // Fallback: redirect to login
        return NextResponse.redirect(new URL("/login", req.url));
    },
    {
        callbacks: {
            // L'utilisateur est autorisé si le token JWT est présent
            authorized: ({ token }) => !!token,
        },
        pages: {
            signIn: "/login",
        }
    }
);

// Configuration du matcher pour protéger toutes les routes SAUF les API publiques, fichiers statiques, etc.
export const config = {
    matcher: [
        /*
         * Match all request paths except for the ones starting with:
         * - api/jellyfin/image (Proxy images publiques)
         * - api/setup (Sauvegarde du serveur)
         * - api/webhook (Réception webhook)
         * - setup (Page de configuration publique)
         * - login (Page de connexion publique)
         * - _next/static (Fichiers Next.js internes statiques)
         * - _next/image (Next.js image optimization API)
         * - favicon.ico, sitemap.xml, robots.txt (Metadata basique)
         */
        "/((?!api/jellyfin/image|api/setup|api/webhook|setup|login|_next/static|_next/image|favicon.ico).*)",
    ],
};
