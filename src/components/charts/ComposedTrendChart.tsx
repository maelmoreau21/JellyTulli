"use client";

import { useState } from 'react';

import {
    ComposedChart,
    Line,
    Area,
    Bar,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    Legend,
    ResponsiveContainer,
} from 'recharts';

interface TrendData {
    time: string;
    movieVolume: number; // in hours
    seriesVolume: number;
    musicVolume: number;
    booksVolume: number;
    totalViews: number; // Bar chart
}

const formatTooltipValue = (value: any, name: any) => {
    if (name === "Vues (Total)") return [`${value} lectures`, name];
    return [`${Number(value).toFixed(1)}h`, name];
};

export function ComposedTrendChart({ data }: { data: TrendData[] }) {
    const [hidden, setHidden] = useState<Set<string>>(new Set());

    const toggleLegend = (e: any) => {
        const dataKey = e.dataKey;
        setHidden(prev => {
            const next = new Set(prev);
            if (next.has(dataKey)) next.delete(dataKey);
            else next.add(dataKey);
            return next;
        });
    };

    return (
        <ResponsiveContainer width="100%" height={300} minHeight={300}>
            <ComposedChart
                data={data}
                margin={{ top: 20, right: 30, left: -10, bottom: 5 }}
            >
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#27272a" />

                {/* XAxis pour les dates / heures */}
                <XAxis
                    dataKey="time"
                    stroke="#52525b"
                    fontSize={12}
                    tickLine={false}
                    axisLine={false}
                />

                <YAxis
                    yAxisId="left"
                    stroke="#52525b"
                    fontSize={12}
                    tickLine={false}
                    axisLine={false}
                    tickFormatter={(val) => `${val}h`}
                />
                <YAxis
                    yAxisId="right"
                    orientation="right"
                    stroke="#52525b"
                    fontSize={12}
                    tickLine={false}
                    axisLine={false}
                />

                <Tooltip
                    contentStyle={{ backgroundColor: '#18181b', borderColor: '#27272a', borderRadius: '8px', color: '#f4f4f5' }}
                    formatter={formatTooltipValue}
                />
                <Legend onClick={toggleLegend} wrapperStyle={{ fontSize: '12px', paddingTop: '10px', cursor: 'pointer' }} />

                {/* Les Barres pour le nombre total de lectures (Vues) */}
                <Bar hide={hidden.has("totalViews")} yAxisId="right" dataKey="totalViews" barSize={20} fill="#3f3f46" radius={[4, 4, 0, 0]} name="Vues (Total)" />

                {/* Les zones empilées pour les volumes horaires */}
                <Area hide={hidden.has("movieVolume")} yAxisId="left" type="monotone" dataKey="movieVolume" stackId="1" stroke="#3b82f6" fill="#3b82f6" fillOpacity={0.6} name="Films" />
                <Area hide={hidden.has("seriesVolume")} yAxisId="left" type="monotone" dataKey="seriesVolume" stackId="1" stroke="#22c55e" fill="#22c55e" fillOpacity={0.6} name="Séries" />
                <Area hide={hidden.has("musicVolume")} yAxisId="left" type="monotone" dataKey="musicVolume" stackId="1" stroke="#eab308" fill="#eab308" fillOpacity={0.6} name="Musique" />
                <Area hide={hidden.has("booksVolume")} yAxisId="left" type="monotone" dataKey="booksVolume" stackId="1" stroke="#a855f7" fill="#a855f7" fillOpacity={0.6} name="Livres" />

            </ComposedChart>
        </ResponsiveContainer>
    );
}
