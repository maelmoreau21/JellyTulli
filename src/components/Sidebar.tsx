'use client';

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
    LayoutDashboard,
    Film,
    ScrollText,
    Users,
    Settings,
    PlayCircle,
    Eraser
} from "lucide-react";
import { LogoutButton } from "./LogoutButton";

const navigation = [
    { name: 'Dashboard', href: '/', icon: LayoutDashboard },
    { name: 'Bibliothèque', href: '/media', icon: Film },
    { name: 'Logs', href: '/logs', icon: ScrollText },
    { name: 'Utilisateurs', href: '/users', icon: Users },
    { name: 'Nettoyage', href: '/admin/cleanup', icon: Eraser },
    { name: 'Paramètres', href: '/settings', icon: Settings },
];

export function Sidebar() {
    const pathname = usePathname();

    // Hide sidebar on login and Wrapped pages (Wrapped uses fullscreen overlay)
    if (pathname === '/login' || pathname?.startsWith('/wrapped')) {
        return null;
    }

    return (
        <div className="flex h-screen w-64 flex-col border-r border-zinc-800 bg-zinc-950/50 backdrop-blur-xl">
            <div className="flex h-16 shrink-0 items-center px-6">
                <Link href="/" className="text-xl font-bold tracking-tight text-primary flex items-center gap-2 hover:opacity-80 transition-opacity">
                    <PlayCircle className="w-6 h-6 text-primary" />
                    <span>JellyTulli</span>
                </Link>
            </div>

            <div className="flex flex-1 flex-col overflow-y-auto px-4 py-4">
                <nav className="flex-1 space-y-1.5">
                    {navigation.map((item) => {
                        const isActive = pathname === item.href || (pathname?.startsWith(item.href) && item.href !== '/');
                        return (
                            <Link
                                key={item.name}
                                href={item.href}
                                className={`group flex items-center rounded-lg px-3 py-2.5 text-sm font-medium transition-all ${isActive
                                    ? "bg-primary/10 text-primary"
                                    : "text-zinc-400 hover:bg-zinc-800/50 hover:text-zinc-50"
                                    }`}
                            >
                                <item.icon
                                    className={`mr-3 h-5 w-5 shrink-0 transition-colors ${isActive ? "text-primary" : "text-zinc-500 group-hover:text-zinc-300"
                                        }`}
                                    aria-hidden="true"
                                />
                                {item.name}
                            </Link>
                        );
                    })}
                </nav>
            </div>

            <div className="border-t border-zinc-800 p-4">
                <LogoutButton className="w-full justify-start text-zinc-400 hover:text-zinc-50 hover:bg-zinc-800/50" />
            </div>
        </div>
    );
}
