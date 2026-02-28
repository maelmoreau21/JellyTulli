"use client";

import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Cell } from "recharts";

interface DropoffData {
    range: string;
    count: number;
}

export default function MediaDropoffChart({ data }: { data: DropoffData[] }) {
    return (
        <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
                <XAxis dataKey="range" tick={{ fill: '#a1a1aa', fontSize: 11 }} />
                <YAxis tick={{ fill: '#a1a1aa', fontSize: 12 }} allowDecimals={false} />
                <Tooltip
                    contentStyle={{ backgroundColor: '#18181b', border: '1px solid #3f3f46', borderRadius: '8px' }}
                    labelStyle={{ color: '#e4e4e7' }}
                    formatter={(value: any) => [`${value} session${value > 1 ? 's' : ''}`, 'Arrêts']}
                />
                <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                    {data.map((_, index) => {
                        // Gradient: rouge (arrêt tôt) → vert (terminé)
                        const ratio = index / Math.max(data.length - 1, 1);
                        const r = Math.round(239 + (34 - 239) * ratio);
                        const g = Math.round(68 + (197 - 68) * ratio);
                        const b = Math.round(68 + (94 - 68) * ratio);
                        return <Cell key={index} fill={`rgb(${r},${g},${b})`} />;
                    })}
                </Bar>
            </BarChart>
        </ResponsiveContainer>
    );
}
