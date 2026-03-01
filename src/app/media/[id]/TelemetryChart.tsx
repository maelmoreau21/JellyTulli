"use client";

import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend } from "recharts";

interface TelemetryData {
    date: string;
    audioChanges: number;
    subtitleChanges: number;
    pauses: number;
}

export default function TelemetryChart({ data }: { data: TelemetryData[] }) {
    if (data.length === 0) return null;

    return (
        <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
                <XAxis dataKey="date" tick={{ fill: '#a1a1aa', fontSize: 11 }} />
                <YAxis tick={{ fill: '#a1a1aa', fontSize: 12 }} allowDecimals={false} />
                <Tooltip
                    contentStyle={{ backgroundColor: '#18181b', border: '1px solid #3f3f46', borderRadius: '8px' }}
                    labelStyle={{ color: '#e4e4e7' }}
                />
                <Legend
                    wrapperStyle={{ fontSize: '12px', color: '#a1a1aa' }}
                />
                <Bar dataKey="pauses" name="Pauses" fill="#eab308" radius={[2, 2, 0, 0]} stackId="a" />
                <Bar dataKey="audioChanges" name="Changements Audio" fill="#a855f7" radius={[0, 0, 0, 0]} stackId="a" />
                <Bar dataKey="subtitleChanges" name="Changements Sous-titres" fill="#06b6d4" radius={[4, 4, 0, 0]} stackId="a" />
            </BarChart>
        </ResponsiveContainer>
    );
}
