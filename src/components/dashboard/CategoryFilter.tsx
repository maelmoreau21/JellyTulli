"use client";

import { useSearchParams, useRouter, usePathname } from "next/navigation";
import { Check, Filter } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { useState, useEffect } from "react";
import { useTranslations } from "next-intl";

const CATEGORIES = [
  { id: 'Movie', i18nKey: 'movies' },
  { id: 'Series', i18nKey: 'series' },
  { id: 'MusicAlbum', i18nKey: 'music' },
  { id: 'Book', i18nKey: 'books' },
];

export function CategoryFilter() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const t = useTranslations('dashboard');
  const tc = useTranslations('common');

  const excludedParam = searchParams.get('excludeTypes');
  const initialExcluded = excludedParam ? excludedParam.split(',') : [];
  
  // Local state to track selections synchronously and avoid searchParams Next.js update delay
  const [localExcluded, setLocalExcluded] = useState<string[]>(initialExcluded);

  // Sync state if URL changes externally
  useEffect(() => {
    setLocalExcluded(excludedParam ? excludedParam.split(',') : []);
  }, [excludedParam]);

  const toggleCategory = (catId: string) => {
    setLocalExcluded((prev) => {
      const isExcluded = prev.includes(catId);
      const newExcluded = isExcluded ? prev.filter(c => c !== catId) : [...prev, catId];
      
      const params = new URLSearchParams(searchParams.toString());
      if (newExcluded.length > 0) {
        params.set('excludeTypes', newExcluded.join(','));
      } else {
        params.delete('excludeTypes');
      }
      router.push(`${pathname}?${params.toString()}`, { scroll: false });
      
      return newExcluded;
    });
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className="h-9 gap-2 shadow-sm rounded-full dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 hidden sm:flex">
          <Filter className="h-4 w-4" />
          <span className="text-sm font-medium">
            {localExcluded.length > 0 ? `${localExcluded.length} ${t('excluded', { defaultMessage: 'Exclus' })}` : tc('all', { defaultMessage: 'Tout' })}
          </span>
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-56 p-0 rounded-xl overflow-hidden shadow-lg border-zinc-200 dark:border-zinc-800" align="end">
        <div className="p-3 bg-zinc-50 dark:bg-zinc-900 border-b border-zinc-100 dark:border-zinc-800/80">
          <h4 className="font-semibold text-sm text-zinc-800 dark:text-zinc-200">{t('filterCategories', { defaultMessage: 'Filtrer les catégories' })}</h4>
          <p className="text-xs text-zinc-500 mt-0.5">{t('uncheckToHide', { defaultMessage: 'Décochez pour masquer du Dashboard' })}</p>
        </div>
        <div className="max-h-[300px] overflow-y-auto p-2 flex flex-col gap-1">
          {CATEGORIES.map((cat) => {
            const isVisible = !localExcluded.includes(cat.id);
            return (
              <button
                key={cat.id}
                onClick={() => toggleCategory(cat.id)}
                className="flex items-center justify-between w-full px-3 py-2 text-sm text-left rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800/50 transition-colors group"
              >
                <span className={`font-medium capitalize truncate ${!isVisible ? 'text-zinc-400 dark:text-zinc-500 line-through' : 'text-zinc-700 dark:text-zinc-300'}`}>
                  {tc(cat.i18nKey)}
                </span>
                <div className={`flex items-center justify-center w-5 h-5 rounded-md border transition-colors ${isVisible ? 'bg-primary border-primary text-white' : 'border-zinc-300 dark:border-zinc-700'}`}>
                  {isVisible && <Check className="w-3.5 h-3.5" />}
                </div>
              </button>
            );
          })}
        </div>
      </PopoverContent>
    </Popover>
  );
}
