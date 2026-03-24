"use client";

import { useEffect, useState } from "react";
import { AlertTriangle, CheckCircle2, AlertCircle, Info, ExternalLink, RefreshCw } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import Link from "next/link";
import { useTranslations } from "next-intl";

interface AuditIssue {
  count: number;
  examples: { id: string; jellyfinMediaId: string; title: string }[];
}

interface AuditData {
  totalMedia: number;
  issues: Record<string, AuditIssue>;
}

const ISSUE_CONFIG: Record<string, { icon: React.ElementType; color: string; severity: "error" | "warning" | "info" }> = {
  missingResolution: { icon: AlertTriangle, color: "text-amber-500", severity: "warning" },
  missingActors: { icon: Info, color: "text-blue-500", severity: "info" },
  orphanItems: { icon: AlertCircle, color: "text-red-500", severity: "error" },
  missingGenres: { icon: Info, color: "text-blue-500", severity: "info" },
};

export function MetadataAudit() {
  const t = useTranslations("dashboard");
  const tc = useTranslations("common");
  const [data, setData] = useState<AuditData | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchData = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/metadata-audit");
      if (res.ok) setData(await res.json());
    } catch { /* silent */ }
    setLoading(false);
  };

  useEffect(() => { fetchData(); }, []);

  if (loading) {
    return (
      <Card className="app-surface-soft border-border animate-pulse">
        <CardHeader className="pb-2">
          <CardTitle className="text-md">{t("metadataAudit")}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-32" />
        </CardContent>
      </Card>
    );
  }

  if (!data) return null;

  const totalIssues = Object.values(data.issues).reduce((sum, i) => sum + i.count, 0);
  const healthPercent = data.totalMedia > 0 ? Math.round(((data.totalMedia - totalIssues) / data.totalMedia) * 100) : 100;
  const healthColor = healthPercent >= 90 ? "text-emerald-500" : healthPercent >= 70 ? "text-amber-500" : "text-red-500";

  return (
    <Card className="app-surface-soft border-border">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-md flex items-center gap-2">
              {healthPercent >= 90 ? (
                <CheckCircle2 className="w-5 h-5 text-emerald-500" />
              ) : (
                <AlertTriangle className="w-5 h-5 text-amber-500" />
              )}
              {t("metadataAudit")}
            </CardTitle>
            <CardDescription className="mt-1">{t("metadataAuditDesc")}</CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <span className={`text-2xl font-bold ${healthColor}`}>{healthPercent}%</span>
            <button onClick={fetchData} className="p-1.5 rounded-md hover:bg-muted transition-colors" title={tc("refresh")}>
              <RefreshCw className="w-4 h-4 text-muted-foreground" />
            </button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {Object.entries(data.issues).map(([key, issue]) => {
          const config = ISSUE_CONFIG[key] || { icon: Info, color: "text-zinc-500", severity: "info" as const };
          const Icon = config.icon;
          if (issue.count === 0) return null;

          return (
            <div key={key} className="rounded-lg border border-border/50 p-3 space-y-2 hover:bg-muted/30 transition-colors">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Icon className={`w-4 h-4 ${config.color}`} />
                  <span className="text-sm font-medium">{t(key)}</span>
                </div>
                <Badge
                  variant={config.severity === "error" ? "destructive" : "outline"}
                  className="text-xs"
                >
                  {issue.count}
                </Badge>
              </div>
              {issue.examples.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mt-1">
                  {issue.examples.slice(0, 5).map((ex) => (
                    <Link
                      key={ex.id}
                      href={`/media/${ex.jellyfinMediaId}`}
                      className="text-[11px] text-muted-foreground hover:text-primary transition-colors flex items-center gap-0.5 bg-muted/50 px-1.5 py-0.5 rounded"
                    >
                      {ex.title.length > 30 ? ex.title.slice(0, 30) + "…" : ex.title}
                      <ExternalLink className="w-2.5 h-2.5" />
                    </Link>
                  ))}
                  {issue.examples.length > 5 && (
                    <span className="text-[11px] text-muted-foreground px-1.5 py-0.5">
                      +{issue.count - 5} {tc("more")}
                    </span>
                  )}
                </div>
              )}
            </div>
          );
        })}
        {totalIssues === 0 && (
          <div className="flex items-center gap-2 text-sm text-emerald-500 py-4 justify-center">
            <CheckCircle2 className="w-5 h-5" />
            {t("metadataAllGood")}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
