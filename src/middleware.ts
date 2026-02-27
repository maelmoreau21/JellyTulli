import { withAuth } from "next-auth/middleware";
import { NextResponse } from "next/server";

export default withAuth(
    function middleware(req) {
        // Optionnel : ajouter de la logique personnalisée si besoin
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
         * - api/webhook (API publique webhook depuis Jellyfin)
         * - api/jellyfin/image (Proxy images publiques)
         * - login (Page de connexion publique)
         * - _next/static (Fichiers Next.js internes statiques)
         * - _next/image (Next.js image optimization API)
         * - favicon.ico, sitemap.xml, robots.txt (Metadata basique)
         */
        "/((?!api/webhook|api/jellyfin/image|login|_next/static|_next/image|favicon.ico).*)",
    ],
};
