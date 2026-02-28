"use client";

import { ResponsiveContainer, BarChart, Bar, AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid, Legend } from "recharts";

export function StandardBarChart({ data, dataKey, fill, name }: { data: any[], dataKey: string, fill: string, name: string }) {
    return (
        <ResponsiveContainer width="100%" height={300} minHeight={300}>
            <BarChart data={data} margin={{ top: 20, right: 20, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#27272a" />
                <XAxis dataKey="time" stroke="#52525b" fontSize={12} tickLine={false} axisLine={false} />
                <YAxis stroke="#52525b" fontSize={12} tickLine={false} axisLine={false} />
                <Tooltip contentStyle={{ backgroundColor: '#18181b', borderColor: '#27272a', borderRadius: '8px', color: '#f4f4f5' }} />
                <Bar dataKey={dataKey} fill={fill} radius={[4, 4, 0, 0]} name={name} />
            </BarChart>
        </ResponsiveContainer>
    );
}

export function StandardAreaChart({ data, dataKey, stroke, name }: { data: any[], dataKey: string, stroke: string, name: string }) {
    return (
        <ResponsiveContainer width="100%" height={300} minHeight={300}>
            <AreaChart data={data} margin={{ top: 20, right: 20, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#27272a" />
                <XAxis dataKey="time" stroke="#52525b" fontSize={12} tickLine={false} axisLine={false} />
                <YAxis stroke="#52525b" fontSize={12} tickLine={false} axisLine={false} />
                <Tooltip contentStyle={{ backgroundColor: '#18181b', borderColor: '#27272a', borderRadius: '8px', color: '#f4f4f5' }} />
                <Area type="monotone" dataKey={dataKey} stroke={stroke} fill={stroke} fillOpacity={0.6} name={name} />
            </AreaChart>
        </ResponsiveContainer>
    );
}
