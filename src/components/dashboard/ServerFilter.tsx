"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Filter, Server } from "lucide-react";
import { useTranslations } from "next-intl";

type ServerOption = {
  id: string;
  name: string;
};

export function ServerFilter({
  servers,
  enabled,
}: {
  servers: ServerOption[];
  enabled: boolean;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const tc = useTranslations("common");

  if (!enabled || servers.length <= 1 || pathname !== "/") return null;

  const selectedRaw = searchParams.get("servers") || "";
  const selected = selectedRaw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  const validIds = new Set(servers.map((s) => s.id));
  const selectedValid = selected.filter((id) => validIds.has(id));
  const allSelected = selectedValid.length === 0;

  const update = (next: string[]) => {
    const params = new URLSearchParams(searchParams.toString());
    if (next.length === 0) {
      params.delete("servers");
    } else {
      params.set("servers", next.join(","));
    }
    router.push(`${pathname}?${params.toString()}`, { scroll: false });
  };

  const toggleServer = (id: string) => {
    if (allSelected) {
      update([id]);
      return;
    }
    const has = selectedValid.includes(id);
    const next = has ? selectedValid.filter((v) => v !== id) : [...selectedValid, id];
    update(next);
  };

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-3 app-surface-soft p-1.5 rounded-xl border border-border/40 backdrop-blur-md transition-all hover:bg-black/5 dark:hover:bg-white/5 group">
        <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-hide py-0.5 px-1">
          <button
            onClick={() => update([])}
            className={`
              flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all duration-300 whitespace-nowrap border
              ${allSelected
                ? "app-surface text-primary border-border shadow-sm"
                : "bg-transparent text-muted-foreground border-transparent hover:bg-black/5 dark:hover:bg-white/5 hover:text-foreground"
              }
            `}
          >
            <Filter className={`w-3.5 h-3.5 ${allSelected ? "text-primary" : "text-zinc-500 opacity-60"}`} />
            {tc("all") || "All"}
          </button>

          {servers.map((server) => {
            const isActive = allSelected ? true : selectedValid.includes(server.id);
            return (
              <button
                key={server.id}
                onClick={() => toggleServer(server.id)}
                className={`
                  flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all duration-300 whitespace-nowrap border
                  ${isActive
                    ? "app-surface text-primary border-border shadow-sm"
                    : "bg-transparent text-muted-foreground border-transparent hover:bg-black/5 dark:hover:bg-white/5 hover:text-foreground"
                  }
                `}
              >
                <Server className={`w-3.5 h-3.5 ${isActive ? "text-primary" : "text-zinc-500 opacity-60"}`} />
                {server.name}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
