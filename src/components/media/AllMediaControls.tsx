"use client";

import React, { useEffect, useState } from 'react';
import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Filter, Film, Tv, Music, Search as SearchIcon, X } from 'lucide-react';

export default function AllMediaControls() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const tc = useTranslations('common');
  const [query, setQuery] = useState(searchParams.get('q') ?? '');

  useEffect(() => {
    setQuery(searchParams.get('q') ?? '');
  }, [searchParams]);

  const typeParam = searchParams.get('type');

  const categories = [
    { id: 'all', label: tc('all') || 'Tout', icon: Filter },
    { id: 'movie', label: tc('movies') || 'Films', icon: Film },
    { id: 'series', label: tc('series') || 'Séries', icon: Tv },
    { id: 'music', label: tc('music') || 'Musique', icon: Music },
  ];

  const setType = (id: string) => {
    const params = new URLSearchParams(searchParams.toString());
    if (id === 'all') params.delete('type');
    else params.set('type', id);
    params.delete('page');
    router.push(`${pathname}?${params.toString()}`, { scroll: false });
  };

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const params = new URLSearchParams(searchParams.toString());
    if (query && query.trim().length >= 2) params.set('q', query.trim());
    else params.delete('q');
    params.delete('page');
    router.push(`${pathname}?${params.toString()}`, { scroll: false });
  };

  const clearQuery = () => {
    setQuery('');
    const params = new URLSearchParams(searchParams.toString());
    params.delete('q');
    params.delete('page');
    router.push(`${pathname}?${params.toString()}`, { scroll: false });
  };

  return (
    <div className="mb-4">
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2 bg-zinc-100/50 dark:bg-zinc-900/40 p-1.5 rounded-xl border border-zinc-200/50 dark:border-zinc-800/50 backdrop-blur-sm">
          {categories.map(cat => {
            const Icon = cat.icon as any;
            const isActive = (cat.id === 'all' && !typeParam) || typeParam === cat.id;
            return (
              <button key={cat.id} onClick={() => setType(cat.id)} className={`flex items-center gap-2 px-3 py-1 rounded-md text-xs font-medium transition ${isActive ? 'bg-white dark:bg-zinc-800 text-primary' : 'text-zinc-500 hover:bg-zinc-200/30 dark:hover:bg-zinc-800/30'}`}>
                <Icon className={`w-4 h-4 ${isActive ? 'text-primary' : 'text-zinc-500'}`} />
                <span className="hidden sm:inline">{cat.label}</span>
              </button>
            );
          })}
        </div>

        <form onSubmit={onSubmit} className="flex items-center gap-2 flex-1">
          <div className="relative flex-1">
            <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder={tc('searchPlaceholder') || 'Rechercher...'} className="app-field w-full pl-9 pr-10" />
            <SearchIcon className="absolute left-3 top-2.5 w-4 h-4 text-zinc-500" />
            {query && (
              <button type="button" onClick={clearQuery} className="absolute right-3 top-2.5 w-6 h-6 flex items-center justify-center text-zinc-400 hover:text-zinc-600">
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
        </form>
      </div>
    </div>
  );
}
