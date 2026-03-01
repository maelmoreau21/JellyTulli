import NextAuth, { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";

export const authOptions: NextAuthOptions = {
    providers: [
        CredentialsProvider({
            name: "Jellyfin",
            credentials: {
                username: { label: "Nom d'utilisateur", type: "text", placeholder: "Admin" },
                password: { label: "Mot de passe Administrateur", type: "password", placeholder: "********" }
            },
            async authorize(credentials) {
                if (!credentials?.username || !credentials?.password) return null;

                const jellyfinUrl = process.env.JELLYFIN_URL;
                if (!jellyfinUrl) {
                    throw new Error("JELLYFIN_URL non configurée dans les variables d'environnement.");
                }

                try {
                    const res = await fetch(`${jellyfinUrl}/Users/AuthenticateByName`, {
                        method: "POST",
                        headers: {
                            "Content-Type": "application/json",
                            "Authorization": `MediaBrowser Client="JellyTulli", Device="Server", DeviceId="JellyTulli-1", Version="1.0.0"`
                        },
                        body: JSON.stringify({
                            Username: credentials.username,
                            Pw: credentials.password
                        })
                    });

                    if (!res.ok) {
                        throw new Error("Identifiants Jellyfin incorrects.");
                    }

                    const data = await res.json();
                    const isAdmin = !!data.User?.Policy?.IsAdministrator;

                    return {
                        id: data.User.Id,
                        name: data.User.Name,
                        isAdmin,
                        jellyfinUserId: data.User.Id,
                    };
                } catch (error: any) {
                    throw new Error(error.message || "Erreur de connexion à Jellyfin.");
                }
            }
        })
    ],
    callbacks: {
        async jwt({ token, user }) {
            // On first sign-in, `user` is defined — persist custom fields into the JWT
            if (user) {
                token.isAdmin = (user as any).isAdmin ?? false;
                token.jellyfinUserId = (user as any).jellyfinUserId ?? user.id;
            }
            return token;
        },
        async session({ session, token }) {
            // Expose custom fields on session.user for client-side access
            if (session.user) {
                (session.user as any).isAdmin = token.isAdmin ?? false;
                (session.user as any).jellyfinUserId = token.jellyfinUserId ?? "";
            }
            return session;
        },
    },
    session: {
        strategy: "jwt",
        maxAge: 30 * 24 * 60 * 60, // 30 jours
    },
    pages: {
        signIn: '/login', // Redirection vers notre page custom
    },
    secret: process.env.NEXTAUTH_SECRET,
};

const handler = NextAuth(authOptions);

export { handler as GET, handler as POST };
