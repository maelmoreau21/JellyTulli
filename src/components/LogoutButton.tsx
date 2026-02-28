"use client";

import { signOut } from "next-auth/react";
import { LogOut } from "lucide-react";

interface LogoutButtonProps {
    className?: string;
}

export function LogoutButton({ className = "" }: LogoutButtonProps) {
    const handleLogout = async () => {
        await signOut({ redirect: false });
        window.location.href = '/login';
    };

    return (
        <button
            onClick={handleLogout}
            className={`flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors ${className}`}
        >
            <LogOut className="w-4 h-4" />
            <span>Déconnexion</span>
        </button>
    );
}
