"use client";

import React, { useMemo, useRef, useState } from 'react';
import { FixedSizeList as List } from 'react-window';
import LogRow from './LogRow';
import SessionModal from '@/components/SessionModal';
import { useTranslations } from 'next-intl';

export default function LogsListClient({ serverLogs, visibleColumns }: { serverLogs: any[]; visibleColumns: string[] }) {
  const t = useTranslations('logs');

  const [selectedLog, setSelectedLog] = useState<any | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  // No client-side search here; server-side LogFilters drives the results.
  const filtered = useMemo(() => serverLogs || [], [serverLogs]);

  // Build watch-party detection locally for display banners
  const watchPartyMap = useMemo(() => {
    const WINDOW_MS = 5 * 60 * 1000;
    const byMedia = new Map();
    filtered.forEach((log: any) => {
      const mId = log.mediaId;
      const started = new Date(String(log.startedAt || '')).getTime();
      if (!mId || !Number.isFinite(started)) return;
      if (!byMedia.has(mId)) byMedia.set(mId, []);
      byMedia.get(mId).push({ log, started });
    });
    const map = new Map();
    let counter = 0;
    byMedia.forEach(list => {
      const sorted = list.sort((a: any, b: any) => a.started - b.started);
      let clusterStart = 0;
      for (let i = 1; i <= sorted.length; i++) {
        if (i === sorted.length || sorted[i].started - sorted[i - 1].started > WINDOW_MS) {
          const cluster = sorted.slice(clusterStart, i);
          const uniqueUsers = new Set(cluster.map((it: any) => it.log.userId));
          if (uniqueUsers.size >= 2) {
            counter++;
            const pid = `party-${counter}`;
            cluster.forEach((item: any) => map.set(item.log.id, pid));
          }
          clusterStart = i;
        }
      }
    });
    return map;
  }, [filtered]);

  const flattened = useMemo(() => {
    const seenParty = new Set<string>();
    const out: any[] = [];
    filtered.forEach((log: any) => {
      const pid = watchPartyMap.get(log.id);
      const isFirst = pid && !seenParty.has(pid);
      if (isFirst) {
        seenParty.add(pid);
        out.push({ type: 'party', id: pid, members: [] as string[], mediaTitle: log.media?.title || '' });
      }
      out.push({ type: 'log', log });
    });
    return out;
  }, [filtered, watchPartyMap]);

  const threshold = 250;

  // saved filter features removed; keep rendering and session modal only

  // Renderers
  const Row = ({ index, style }: { index: number; style: any }) => {
    const item = flattened[index];
    if (!item) return null;
    if (item.type === 'party') {
      return (
        <div style={style} className="p-2 border-b bg-gradient-to-r from-violet-50 to-fuchsia-50">
          <div className="font-medium">Watch Party — {item.mediaTitle}</div>
        </div>
      );
    }
    return (
      <div style={style} className="border-b">
        <LogRow log={item.log} visibleColumns={visibleColumns} onOpenDetails={(l: any) => setSelectedLog(l)} />
      </div>
    );
  };

  return (
    <div className="space-y-3">
      {/* Client-side search removed: rely on server-side LogFilters */}

      <div ref={containerRef} className="w-full">
        {flattened.length === 0 ? (
          <div className="text-center py-8 text-zinc-400">{t('noResults')}</div>
        ) : (
          flattened.length > threshold ? (
            <List height={600} itemCount={flattened.length} itemSize={84} width={'100%'}>
              {Row}
            </List>
          ) : (
            <div>
              {flattened.map((item, idx) => item.type === 'party' ? (
                <div key={`party-${idx}`} className="p-2 border-b bg-gradient-to-r from-violet-50 to-fuchsia-50">Watch Party — {item.mediaTitle}</div>
              ) : (
                <div key={item.log.id} className="border-b">
                  <LogRow log={item.log} visibleColumns={visibleColumns} onOpenDetails={(l: any) => setSelectedLog(l)} />
                </div>
              ))}
            </div>
          )
        )}
      </div>

      {selectedLog && (
        <SessionModal open={true} onClose={() => setSelectedLog(null)} session={selectedLog} />
      )}
    </div>
  );
}
