"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export function TimeRangeSelector() {
    const router = useRouter();
    const pathname = usePathname();
    const searchParams = useSearchParams();
    const timeRange = searchParams.get("timeRange") || "7d";

    const handleValueChange = (value: string) => {
        const params = new URLSearchParams(searchParams.toString());
        params.set("timeRange", value);
        router.push(`${pathname}?${params.toString()}`);
    };

    return (
        <Select value={timeRange} onValueChange={handleValueChange}>
            <SelectTrigger className="w-[180px] bg-zinc-900 border-zinc-800 text-sm h-9">
                <SelectValue placeholder="Période" />
            </SelectTrigger>
            <SelectContent className="bg-zinc-900 border-zinc-800">
                <SelectItem value="24h">Dernières 24h</SelectItem>
                <SelectItem value="7d">7 derniers jours</SelectItem>
                <SelectItem value="30d">30 derniers jours</SelectItem>
                <SelectItem value="all">Tout le temps</SelectItem>
            </SelectContent>
        </Select>
    );
}
