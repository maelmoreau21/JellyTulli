import { withAuth } from "next-auth/middleware";
import { NextResponse } from "next/server";

// Routes accessibles par TOUS les utilisateurs authentifiés (admins + non-admins)
const PUBLIC_USER_PATHS = ["/wrapped", "/api/auth", "/api/jellyfin"];
// Routes réservées strictement aux administrateurs
const ADMIN_API_PATHS = ["/api/sync", "/api/backup", "/api/hardware", "/api/settings", "/api/admin"];
// Pages admin-only (non-admins redirigés vers leur Wrapped)
const ADMIN_PAGE_PATHS = ["/", "/logs", "/users", "/media", "/newsletter", "/admin", "/settings"];

export default withAuth(
    function middleware(req) {
        const token = req.nextauth.token;
        const pathname = req.nextUrl.pathname;

        // Allow admin users everywhere
        if (token?.isAdmin) {
            return NextResponse.next();
        }

        // Non-admin users: allow public user paths
        const isAllowed = PUBLIC_USER_PATHS.some(p => pathname.startsWith(p));
        if (isAllowed) {
            return NextResponse.next();
        }

        // Non-admin hitting admin API routes → 403 JSON response
        const isAdminApi = ADMIN_API_PATHS.some(p => pathname.startsWith(p));
        if (isAdminApi) {
            return NextResponse.json({ error: "Accès réservé aux administrateurs." }, { status: 403 });
        }

        // Non-admin hitting admin pages → redirect to their Wrapped page
        const isAdminPage = ADMIN_PAGE_PATHS.some(p => pathname === p || (p !== "/" && pathname.startsWith(p)));
        if (isAdminPage) {
            const jellyfinUserId = token?.jellyfinUserId as string;
            if (jellyfinUserId) {
                return NextResponse.redirect(new URL(`/wrapped/${jellyfinUserId}`, req.url));
            }
            return NextResponse.redirect(new URL("/login", req.url));
        }

        // All other routes: allow for any authenticated user
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
         * - api/setup (Sauvegarde du serveur)
         * - api/webhook (Réception webhook)
         * - setup (Page de configuration publique)
         * - login (Page de connexion publique)
         * - _next/static (Fichiers Next.js internes statiques)
         * - _next/image (Next.js image optimization API)
         * - favicon.ico, sitemap.xml, robots.txt (Metadata basique)
         */
        "/((?!api/jellyfin/image|api/setup|api/webhook|setup|login|_next|favicon.ico).*)",
    ],
};
