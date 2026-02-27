import NextAuth, { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";

export const authOptions: NextAuthOptions = {
    providers: [
        CredentialsProvider({
            name: "Password",
            credentials: {
                password: { label: "Mot de passe Administrateur", type: "password", placeholder: "********" }
            },
            async authorize(credentials) {
                const adminPassword = process.env.ADMIN_PASSWORD;

                if (!adminPassword) {
                    throw new Error("ADMIN_PASSWORD n'est pas configuré sur le serveur.");
                }

                if (credentials?.password === adminPassword) {
                    // Authentification réussie
                    return { id: "admin", name: "Administrateur" };
                }

                // Echec de l'authentification
                return null;
            }
        })
    ],
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
