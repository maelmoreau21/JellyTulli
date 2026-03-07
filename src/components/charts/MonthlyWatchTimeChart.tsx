"use client";

import { useTranslations } from 'next-intl';
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
    month: string; // "Jan", "Fév", etc.
    hours: number;
}

interface MonthlyWatchTimeChartProps {
    data: MonthlyWatchData[];
}

const COLORS = [
    "#6366f1", "#818cf8", "#a5b4fc", "#c7d2fe",
    "#6366f1", "#818cf8", "#a5b4fc", "#c7d2fe",
    "#6366f1", "#818cf8", "#a5b4fc", "#c7d2fe",
];

export function MonthlyWatchTimeChart({ data }: MonthlyWatchTimeChartProps) {
    const t = useTranslations('charts');
    const maxHours = Math.max(...data.map((d) => d.hours), 1);

    return (
        <ResponsiveContainer width="100%" height={300} minHeight={300}>
            <BarChart data={data} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
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
                    formatter={(value: number) => [`${value.toFixed(1)}h`, t('watchTime')]}
                    labelStyle={chartLabelStyle}
                    itemStyle={chartItemStyle}
                />
                <Bar dataKey="hours" radius={[4, 4, 0, 0]}>
                    {data.map((entry, index) => (
                        <Cell
                            key={`cell-${index}`}
                            fill={entry.hours === maxHours ? "#f97316" : "url(#monthlyWatchGradient)"}
                            fillOpacity={0.6 + (entry.hours / maxHours) * 0.4}
                        />
                    ))}
                </Bar>
            </BarChart>
        </ResponsiveContainer>
    );
}
