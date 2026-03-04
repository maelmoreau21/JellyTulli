'use client';

import { useLocale } from 'next-intl';
import { useRouter } from 'next/navigation';
import { useState, useRef, useEffect, useTransition } from 'react';
import { Globe } from 'lucide-react';
import { AVAILABLE_LOCALES, DEFAULT_LOCALE, isSupportedLocale } from '@/i18n/locales';

export function LanguageSwitcher() {
    const locale = useLocale();
    const router = useRouter();
    const [isPending, startTransition] = useTransition();
    const [open, setOpen] = useState(false);
    const ref = useRef<HTMLDivElement>(null);
    const selectedLocale = isSupportedLocale(locale) ? locale : DEFAULT_LOCALE;
    const current = AVAILABLE_LOCALES.find(l => l.code === selectedLocale) || AVAILABLE_LOCALES[0];

    useEffect(() => {
        const handler = (e: MouseEvent) => {
            if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, []);

    function switchLocale(newLocale: string) {
        if (!isSupportedLocale(newLocale)) return;
        document.cookie = `locale=${newLocale};path=/;max-age=${365 * 24 * 60 * 60}`;
        setOpen(false);
        startTransition(() => {
            router.refresh();
        });
    }

    return (
        <div className="relative" ref={ref}>
            <button
                onClick={() => setOpen(!open)}
                disabled={isPending}
                className={`flex items-center gap-2 w-full h-9 rounded-md border border-zinc-700 bg-zinc-900/80 px-2.5 text-xs text-zinc-200 hover:bg-zinc-800 transition-colors ${isPending ? 'opacity-50 cursor-wait' : ''}`}
                aria-label="Language"
            >
                <Globe className="w-3.5 h-3.5 text-zinc-400 shrink-0" />
                <span className="text-base leading-none">{current.flag}</span>
                <span className="truncate">{current.label}</span>
            </button>
            {open && (
                <div className="absolute bottom-full left-0 mb-1 z-50 w-full bg-zinc-900 border border-zinc-700 rounded-lg shadow-xl py-1 max-h-60 overflow-y-auto">
                    {AVAILABLE_LOCALES.map((loc) => (
                        <button
                            key={loc.code}
                            onClick={() => switchLocale(loc.code)}
                            className={`flex items-center gap-2 w-full px-2.5 py-2 text-xs hover:bg-zinc-800 transition-colors ${loc.code === selectedLocale ? 'text-primary bg-primary/10' : 'text-zinc-300'}`}
                        >
                            <span className="text-base leading-none">{loc.flag}</span>
                            <span>{loc.label}</span>
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
}
