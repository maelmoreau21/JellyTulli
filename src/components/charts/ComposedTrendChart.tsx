"use client";

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
    otherVolume: number;
    totalViews: number; // Bar chart
}

const formatTooltipValue = (value: number, name: string) => {
    if (name === "Vues (Total)") return [`${value} lectures`, name];
    return [`${value.toFixed(1)}h`, name];
};

export function ComposedTrendChart({ data }: { data: TrendData[] }) {
    return (
        <ResponsiveContainer width="100%" height="100%">
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
                <Legend wrapperStyle={{ fontSize: '12px', paddingTop: '10px' }} />

                {/* Les Barres pour le nombre total de lectures (Vues) */}
                <Bar yAxisId="right" dataKey="totalViews" barSize={20} fill="#3f3f46" radius={[4, 4, 0, 0]} name="Vues (Total)" />

                {/* Les zones empilées pour les volumes horaires */}
                <Area yAxisId="left" type="monotone" dataKey="movieVolume" stackId="1" stroke="#3b82f6" fill="#3b82f6" fillOpacity={0.6} name="Films" />
                <Area yAxisId="left" type="monotone" dataKey="seriesVolume" stackId="1" stroke="#22c55e" fill="#22c55e" fillOpacity={0.6} name="Séries" />
                <Area yAxisId="left" type="monotone" dataKey="musicVolume" stackId="1" stroke="#eab308" fill="#eab308" fillOpacity={0.6} name="Musique" />
                <Area yAxisId="left" type="monotone" dataKey="otherVolume" stackId="1" stroke="#a855f7" fill="#a855f7" fillOpacity={0.6} name="Autres" />

            </ComposedChart>
        </ResponsiveContainer>
    );
}
