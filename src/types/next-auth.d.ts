import { DefaultSession, DefaultUser } from "next-auth";
import { DefaultJWT } from "next-auth/jwt";

declare module "next-auth" {
    interface Session extends DefaultSession {
        user: DefaultSession["user"] & {
            isAdmin: boolean;
            jellyfinUserId: string;
        };
    }
    interface User extends DefaultUser {
        isAdmin: boolean;
        jellyfinUserId: string;
    }
}

declare module "next-auth/jwt" {
    interface JWT extends DefaultJWT {
        isAdmin?: boolean;
        jellyfinUserId?: string;
    }
}
