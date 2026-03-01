"use client";

import { useMemo, useState } from "react";
import { ActivityCalendar, ThemeInput } from "react-activity-calendar";
import { format, eachDayOfInterval, startOfYear, endOfYear } from "date-fns";
import { fr } from "date-fns/locale";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { ChevronLeft, ChevronRight } from "lucide-react";

export interface HeatmapData {
    date: string; // YYYY-MM-DD
    count: number;
    level: 0 | 1 | 2 | 3 | 4;
}

interface YearlyHeatmapProps {
    data: HeatmapData[];
    availableYears: number[];
}

const customTheme: ThemeInput = {
    light: ['#ebedf0', '#9be9a8', '#40c463', '#30a14e', '#216e39'],
    dark: ['#18181b', '#312e81', '#4338ca', '#4f46e5', '#6366f1'],
};

export function YearlyHeatmap({ data, availableYears }: YearlyHeatmapProps) {
    const currentYear = new Date().getFullYear();
    const [selectedYear, setSelectedYear] = useState(currentYear);

    const sortedYears = useMemo(() => {
        const years = [...new Set([...availableYears, currentYear])].sort((a, b) => b - a);
        return years;
    }, [availableYears, currentYear]);

    const canGoPrev = sortedYears.indexOf(selectedYear) < sortedYears.length - 1;
    const canGoNext = sortedYears.indexOf(selectedYear) > 0;

    const processedData = useMemo(() => {
        const jan1 = startOfYear(new Date(selectedYear, 0, 1));
        const dec31 = endOfYear(new Date(selectedYear, 0, 1));

        // Filter data for the selected year
        const yearEntries = data.filter(d => d.date.startsWith(String(selectedYear)));
        const dataMap = new Map(yearEntries.map(d => [d.date, d]));

        // Recompute levels based on this year's max
        const counts = yearEntries.map(d => d.count);
        const maxCount = counts.length > 0 ? Math.max(...counts) : 1;
        const getLevel = (count: number): 0 | 1 | 2 | 3 | 4 => {
            if (count === 0) return 0;
            const ratio = count / maxCount;
            if (ratio < 0.25) return 1;
            if (ratio < 0.5) return 2;
            if (ratio < 0.75) return 3;
            return 4;
        };

        const yearData: HeatmapData[] = [];
        const allDays = eachDayOfInterval({ start: jan1, end: dec31 });
        for (const date of allDays) {
            const dateStr = format(date, "yyyy-MM-dd");
            const existing = dataMap.get(dateStr);
            yearData.push({
                date: dateStr,
                count: existing?.count || 0,
                level: existing ? getLevel(existing.count) : 0,
            });
        }
        return yearData;
    }, [data, selectedYear]);

    const totalPlays = processedData.reduce((sum, d) => sum + d.count, 0);

    return (
        <Card className="bg-zinc-900/50 border-zinc-800 backdrop-blur-sm overflow-hidden flex flex-col">
            <CardHeader className="w-full pb-2">
                <CardTitle className="text-zinc-100 flex items-center justify-between">
                    <span>Activité Annuelle</span>
                    <div className="flex items-center gap-2">
                        <button
                            onClick={() => {
                                const idx = sortedYears.indexOf(selectedYear);
                                if (idx < sortedYears.length - 1) setSelectedYear(sortedYears[idx + 1]);
                            }}
                            disabled={!canGoPrev}
                            className="p-1 rounded-md hover:bg-zinc-800 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                            title="Année précédente"
                        >
                            <ChevronLeft className="w-4 h-4" />
                        </button>
                        <span className="text-sm font-medium text-zinc-300 bg-zinc-800/50 px-3 py-1 rounded-md min-w-[60px] text-center">
                            {selectedYear}
                        </span>
                        <button
                            onClick={() => {
                                const idx = sortedYears.indexOf(selectedYear);
                                if (idx > 0) setSelectedYear(sortedYears[idx - 1]);
                            }}
                            disabled={!canGoNext}
                            className="p-1 rounded-md hover:bg-zinc-800 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                            title="Année suivante"
                        >
                            <ChevronRight className="w-4 h-4" />
                        </button>
                    </div>
                </CardTitle>
                <CardDescription className="text-zinc-400">
                    {totalPlays} lecture{totalPlays !== 1 ? 's' : ''} en {selectedYear}
                </CardDescription>
            </CardHeader>
            <CardContent className="w-full overflow-x-auto pb-6 pt-4 px-4 scrollbar-thin scrollbar-thumb-zinc-800 scrollbar-track-transparent">
                <div className="w-full">
                    <ActivityCalendar
                        data={processedData}
                        theme={customTheme}
                        colorScheme="dark"
                        blockSize={14}
                        blockRadius={3}
                        blockMargin={3}
                        fontSize={12}
                        labels={{
                            months: ['Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Juin', 'Juil', 'Août', 'Sep', 'Oct', 'Nov', 'Déc'],
                            weekdays: ['Dim', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam'],
                            totalCount: '{{count}} lectures en {{year}}',
                            legend: {
                                less: 'Moins',
                                more: 'Plus'
                            }
                        }}
                        renderBlock={(block: any, activity: any) => (
                            <TooltipProvider delayDuration={50}>
                                <Tooltip>
                                    <TooltipTrigger asChild>{block}</TooltipTrigger>
                                    <TooltipContent className="bg-zinc-800 text-zinc-100 border-zinc-700 pointer-events-none">
                                        <div className="flex flex-col text-xs space-y-1">
                                            <span className="font-semibold">{activity.count} {activity.count === 1 ? 'lecture' : 'lectures'}</span>
                                            <span className="text-zinc-400">
                                                {format(new Date(activity.date), "EEEE d MMMM yyyy", { locale: fr })}
                                            </span>
                                        </div>
                                    </TooltipContent>
                                </Tooltip>
                            </TooltipProvider>
                        )}
                    />
                </div>
            </CardContent>
        </Card>
    );
}
