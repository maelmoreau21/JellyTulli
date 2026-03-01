import { withAuth } from "next-auth/middleware";
import { NextResponse } from "next/server";

// Routes réservées strictement aux administrateurs
const ADMIN_API_PATHS = ["/api/admin"];
const ADMIN_PAGE_PATHS = ["/admin", "/settings"];

export default withAuth(
    function middleware(req) {
        const token = req.nextauth.token;
        const pathname = req.nextUrl.pathname;

        // Admin: accès total
        if (token?.isAdmin) {
            return NextResponse.next();
        }

        // Non-admin → API admin bloquées (403)
        const isAdminApi = ADMIN_API_PATHS.some(p => pathname.startsWith(p));
        if (isAdminApi) {
            return NextResponse.json({ error: "Accès réservé aux administrateurs." }, { status: 403 });
        }

        // Non-admin → Pages admin redirigées vers Wrapped
        const isAdminPage = ADMIN_PAGE_PATHS.some(p => pathname === p || pathname.startsWith(p + "/"));
        if (isAdminPage) {
            const jellyfinUserId = token?.jellyfinUserId as string;
            if (jellyfinUserId) {
                return NextResponse.redirect(new URL(`/wrapped/${jellyfinUserId}`, req.url));
            }
            return NextResponse.redirect(new URL("/login", req.url));
        }

        // Tout le reste : accessible à tous les utilisateurs authentifiés
        return NextResponse.next();
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
         * - api/webhook (Réception webhook)
         * - login (Page de connexion publique)
         * - _next/static (Fichiers Next.js internes statiques)
         * - _next/image (Next.js image optimization API)
         * - favicon.ico, sitemap.xml, robots.txt (Metadata basique)
         */
        "/((?!api/jellyfin/image|api/webhook|login|_next|favicon.ico).*)",
    ],
};
