"use client";

import { useMemo } from "react";
import { ActivityCalendar, ThemeInput } from "react-activity-calendar";
import { format, subDays } from "date-fns";
import { fr } from "date-fns/locale";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

export interface HeatmapData {
    date: string; // YYYY-MM-DD
    count: number;
    level: 0 | 1 | 2 | 3 | 4;
}

interface YearlyHeatmapProps {
    data: HeatmapData[];
}

const customTheme: ThemeInput = {
    light: ['#ebedf0', '#9be9a8', '#40c463', '#30a14e', '#216e39'],
    dark: ['#18181b', '#312e81', '#4338ca', '#4f46e5', '#6366f1'], // Zinc-900 to Indigo-500
};

export function YearlyHeatmap({ data }: YearlyHeatmapProps) {
    // Fill in the blanks (ActivityCalendar needs continuous dates for the last 365 days)
    const processedData = useMemo(() => {
        const today = new Date();
        const yearData: HeatmapData[] = [];

        // Loop backwards from today to 365 days ago
        for (let i = 364; i >= 0; i--) {
            const date = subDays(today, i);
            const dateStr = format(date, "yyyy-MM-dd");
            const existing = data.find(d => d.date === dateStr);

            if (existing) {
                yearData.push(existing);
            } else {
                yearData.push({
                    date: dateStr,
                    count: 0,
                    level: 0
                });
            }
        }
        return yearData;
    }, [data]);

    return (
        <Card className="bg-zinc-900/50 border-zinc-800 backdrop-blur-sm overflow-hidden flex flex-col items-center">
            <CardHeader className="w-full pb-2">
                <CardTitle className="text-zinc-100 flex items-center justify-between">
                    <span>Activité Annuelle</span>
                    <span className="text-xs font-normal text-zinc-500 bg-zinc-800/50 px-2 py-1 rounded-md">
                        365 jours
                    </span>
                </CardTitle>
                <CardDescription className="text-zinc-400">
                    Volume de lectures quotidien sur l'année écoulée
                </CardDescription>
            </CardHeader>
            <CardContent className="w-full overflow-x-auto pb-6 pt-4 px-6 scrollbar-thin scrollbar-thumb-zinc-800 scrollbar-track-transparent">
                <div className="min-w-max">
                    <ActivityCalendar
                        data={processedData}
                        theme={customTheme}
                        colorScheme="dark"
                        blockSize={12}
                        blockRadius={3}
                        blockMargin={4}
                        fontSize={12}
                        hideColorLegend={false}
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
