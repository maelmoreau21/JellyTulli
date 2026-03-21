"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";

export default function SettingsNotificationsRedirect() {
    const router = useRouter();
    useEffect(() => {
        router.replace('/settings#notifications');
    }, [router]);

    return (
        <div className="p-8 max-w-[900px] mx-auto">
            <div className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="w-4 h-4 animate-spin" /> Redirection vers Paramètres…</div>
        </div>
    );
}
