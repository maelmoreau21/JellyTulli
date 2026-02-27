"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export function Navigation() {
    const pathname = usePathname();

    const isActive = (path: string) => {
        if (path === "/" && pathname !== "/") return false;
        return pathname.startsWith(path);
    };

    return (
        <nav className="flex items-center space-x-4 lg:space-x-6 mx-6">
            <Link
                href="/"
                className={`text-sm font-medium transition-colors ${isActive('/') ? 'text-primary' : 'text-muted-foreground hover:text-primary'}`}
            >
                Dashboard
            </Link>
            <Link
                href="/media"
                className={`text-sm font-medium transition-colors ${isActive('/media') ? 'text-primary' : 'text-muted-foreground hover:text-primary'}`}
            >
                Médias
            </Link>
            <Link
                href="/logs"
                className={`text-sm font-medium transition-colors ${isActive('/logs') ? 'text-primary' : 'text-muted-foreground hover:text-primary'}`}
            >
                Logs
            </Link>
            <Link
                href="/settings"
                className={`text-sm font-medium transition-colors ${isActive('/settings') ? 'text-primary' : 'text-muted-foreground hover:text-primary'}`}
            >
                Paramètres
            </Link>
        </nav>
    );
}
