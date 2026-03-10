"use client";

import { useState, useMemo } from "react";
import { useTranslations } from 'next-intl';
import { ChevronLeft, ChevronRight } from "lucide-react";
import {
    BarChart,
    Bar,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer,
    Cell,
} from "recharts";
import { chartAxisColor, chartGridColor, chartItemStyle, chartLabelStyle, chartTooltipStyle } from "@/lib/chartTheme";

export interface MonthlyWatchData {
    month: string; // "2026_0" = year_monthIndex
    hours: number;
}

interface MonthlyWatchTimeChartProps {
    data: MonthlyWatchData[];
    monthNames: string[];
}

export function MonthlyWatchTimeChart({ data, monthNames }: MonthlyWatchTimeChartProps) {
    const t = useTranslations('charts');

    // Extract available years from data
    const availableYears = useMemo(() => {
        const years = new Set<number>();
        data.forEach(d => {
            const year = parseInt(d.month.split('_')[0]);
            if (!isNaN(year)) years.add(year);
        });
        if (years.size === 0) years.add(new Date().getFullYear());
        return Array.from(years).sort();
    }, [data]);

    const [selectedYear, setSelectedYear] = useState(() => {
        return availableYears[availableYears.length - 1] || new Date().getFullYear();
    });

    const yearIndex = availableYears.indexOf(selectedYear);
    const canGoBack = yearIndex > 0;
    const canGoForward = yearIndex < availableYears.length - 1;

    // Build chart data for the selected year: always 12 months
    const chartData = useMemo(() => {
        const dataMap = new Map<string, number>();
        data.forEach(d => {
            dataMap.set(d.month, d.hours);
        });

        return Array.from({ length: 12 }, (_, i) => {
            const key = `${selectedYear}_${i}`;
            return {
                month: monthNames[i] || `M${i + 1}`,
                hours: dataMap.get(key) || 0,
            };
        });
    }, [data, selectedYear, monthNames]);

    const maxHours = Math.max(...chartData.map((d) => d.hours), 1);

    return (
        <div className="flex flex-col h-full">
            {/* Year navigation */}
            <div className="flex items-center justify-center gap-3 mb-2">
                <button
                    onClick={() => canGoBack && setSelectedYear(availableYears[yearIndex - 1])}
                    disabled={!canGoBack}
                    className="p-1 rounded-md hover:bg-zinc-700/50 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                >
                    <ChevronLeft className="w-4 h-4 text-zinc-300" />
                </button>
                <span className="text-sm font-semibold text-zinc-200 min-w-[4rem] text-center">
                    {selectedYear}
                </span>
                <button
                    onClick={() => canGoForward && setSelectedYear(availableYears[yearIndex + 1])}
                    disabled={!canGoForward}
                    className="p-1 rounded-md hover:bg-zinc-700/50 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                >
                    <ChevronRight className="w-4 h-4 text-zinc-300" />
                </button>
            </div>

            <ResponsiveContainer width="100%" height={260} minHeight={260}>
                <BarChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <defs>
                        <linearGradient id="monthlyWatchGradient" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor="#38bdf8" stopOpacity={0.95} />
                            <stop offset="100%" stopColor="#a855f7" stopOpacity={0.7} />
                        </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 7" vertical={false} stroke={chartGridColor} />
                    <XAxis
                        dataKey="month"
                        stroke={chartAxisColor}
                        fontSize={11}
                        tickLine={false}
                        axisLine={false}
                    />
                    <YAxis
                        stroke={chartAxisColor}
                        fontSize={11}
                        tickLine={false}
                        axisLine={false}
                        allowDecimals={false}
                        tickFormatter={(v) => `${v}h`}
                    />
                    <Tooltip
                        contentStyle={chartTooltipStyle}
                        formatter={(value: number | undefined) => [`${(value ?? 0).toFixed(1)}h`, t('watchTime')]}
                        labelStyle={chartLabelStyle}
                        itemStyle={chartItemStyle}
                    />
                    <Bar dataKey="hours" radius={[4, 4, 0, 0]}>
                        {chartData.map((entry, index) => (
                            <Cell
                                key={`cell-${index}`}
                                fill={entry.hours === maxHours && maxHours > 0 ? "#f97316" : "url(#monthlyWatchGradient)"}
                                fillOpacity={maxHours > 0 ? 0.6 + (entry.hours / maxHours) * 0.4 : 0.3}
                            />
                        ))}
                    </Bar>
                </BarChart>
            </ResponsiveContainer>
        </div>
    );
}
