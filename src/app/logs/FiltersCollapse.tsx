"use client";

import React, { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { ChevronDown, ChevronUp } from "lucide-react";
import { useTranslations } from "next-intl";

interface FiltersCollapseProps {
    children: React.ReactNode;
    storageKey?: string;
    defaultOpen?: boolean;
}

export function FiltersCollapse({ children, storageKey = "logs.filtersOpen", defaultOpen = true }: FiltersCollapseProps) {
    const tc = useTranslations("common");
    const [open, setOpen] = useState<boolean>(() => {
        try {
            if (typeof window === "undefined") return defaultOpen;
            const raw = localStorage.getItem(storageKey);
            return raw !== null ? raw === "1" : defaultOpen;
        } catch {
            return defaultOpen;
        }
    });

    useEffect(() => {
        try {
            localStorage.setItem(storageKey, open ? "1" : "0");
        } catch {
            // ignore
        }
    }, [open, storageKey]);

    return (
        <div>
            <div className="flex items-center justify-between">
                <div className="min-w-0">
                    <div className="text-sm font-semibold text-zinc-700 dark:text-zinc-200">{tc("filters")}</div>
                </div>
                <div>
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setOpen((v) => !v)}
                        aria-expanded={open}
                        className="h-9"
                    >
                        {open ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                        <span className="ml-2 hidden md:inline">{open ? tc("close") : tc("filters")}</span>
                    </Button>
                </div>
            </div>

            <div className={`mt-3 ${open ? "block" : "hidden"}`}>
                {children}
            </div>
        </div>
    );
}
