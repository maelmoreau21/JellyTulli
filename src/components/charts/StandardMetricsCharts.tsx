"use client";

import { ResponsiveContainer, BarChart, Bar, AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid, Legend, PieChart, Pie, Cell } from "recharts";

const COLORS = ['#3b82f6', '#8b5cf6', '#ec4899', '#f97316', '#eab308', '#22c55e'];

interface BarChartProps {
    data: any[];
    dataKey: string;
    fill: string;
    name: string;
    horizontal?: boolean;
    xAxisKey?: string;
}

export function StandardBarChart({ data, dataKey, fill, name, horizontal, xAxisKey = "time" }: BarChartProps) {
    if (horizontal) {
        return (
            <ResponsiveContainer width="100%" height={300} minHeight={300}>
                <BarChart data={data} layout="vertical" margin={{ top: 20, right: 20, left: 40, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#27272a" />
                    <XAxis type="number" stroke="#52525b" fontSize={12} tickLine={false} axisLine={false} />
                    <YAxis dataKey={xAxisKey} type="category" stroke="#52525b" fontSize={12} tickLine={false} axisLine={false} width={100} />
                    <Tooltip contentStyle={{ backgroundColor: '#18181b', borderColor: '#27272a', borderRadius: '8px', color: '#f4f4f5' }} labelStyle={{ color: '#a1a1aa' }} itemStyle={{ color: '#e4e4e7' }} />
                    <Bar dataKey={dataKey} fill={fill} radius={[0, 4, 4, 0]} name={name} />
                </BarChart>
            </ResponsiveContainer>
        );
    }

    return (
        <ResponsiveContainer width="100%" height={300} minHeight={300}>
            <BarChart data={data} margin={{ top: 20, right: 20, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#27272a" />
                <XAxis dataKey={xAxisKey} stroke="#52525b" fontSize={12} tickLine={false} axisLine={false} />
                <YAxis stroke="#52525b" fontSize={12} tickLine={false} axisLine={false} />
                <Tooltip contentStyle={{ backgroundColor: '#18181b', borderColor: '#27272a', borderRadius: '8px', color: '#f4f4f5' }} labelStyle={{ color: '#a1a1aa' }} itemStyle={{ color: '#e4e4e7' }} />
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
                <Tooltip contentStyle={{ backgroundColor: '#18181b', borderColor: '#27272a', borderRadius: '8px', color: '#f4f4f5' }} labelStyle={{ color: '#a1a1aa' }} itemStyle={{ color: '#e4e4e7' }} />
                <Area type="monotone" dataKey={dataKey} stroke={stroke} fill={stroke} fillOpacity={0.6} name={name} />
            </AreaChart>
        </ResponsiveContainer>
    );
}

export function StandardPieChart({ data, nameKey, dataKey }: { data: any[], nameKey: string, dataKey: string }) {
    return (
        <ResponsiveContainer width="100%" height={300} minHeight={300}>
            <PieChart>
                <Pie
                    data={data}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={100}
                    fill="#8884d8"
                    paddingAngle={2}
                    dataKey={dataKey}
                    nameKey={nameKey}
                    stroke="none"
                    label={({ name, percent }) => `${name} ${((percent || 0) * 100).toFixed(0)}%`}
                    labelLine={false}
                >
                    {data.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                </Pie>
                <Tooltip
                    contentStyle={{ backgroundColor: '#18181b', borderColor: '#27272a', borderRadius: '8px', color: '#f4f4f5' }}
                    labelStyle={{ color: '#a1a1aa' }}
                    itemStyle={{ color: '#f4f4f5' }}
                />
            </PieChart>
        </ResponsiveContainer>
    );
}
