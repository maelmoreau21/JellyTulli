"use client";

import { BarChart, Bar, AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid, Legend } from "recharts";
import ResponsiveContainer from "./ResponsiveContainerGuard";
import { chartAxisColor, chartGridColor, chartItemStyle, chartLabelStyle, chartPalette, chartTooltipStyle } from "@/lib/chartTheme";

const COLORS = chartPalette;

export function StackedBarChart({ data, keys, suffix, labelMap, onClick }: { data: Record<string, any>[], keys: string[], suffix: string, labelMap?: Record<string, string>, onClick?: (key: string, data: any) => void }) {
    const activeKeys = keys.filter(k => data.some(entry => (Number(entry[`${k}${suffix}`]) || 0) > 0));
    
    return (
        <ResponsiveContainer width="100%" height={300} minHeight={250}>
            <BarChart data={data} margin={{ top: 20, right: 10, left: -25, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 7" vertical={false} stroke={chartGridColor} />
                <XAxis dataKey="time" stroke={chartAxisColor} fontSize={10} tickLine={false} axisLine={false} interval="preserveStartEnd" />
                <YAxis stroke={chartAxisColor} fontSize={10} tickLine={false} axisLine={false} width={45} />
                <Tooltip contentStyle={chartTooltipStyle} labelStyle={chartLabelStyle} itemStyle={chartItemStyle} />
                <Legend wrapperStyle={{ fontSize: '10px', paddingTop: '8px' }} />
                {activeKeys.map((k, i) => (
                    <Bar 
                        key={k} 
                        dataKey={(entry: Record<string, any>) => entry?.[`${k}${suffix}`] || 0} 
                        name={labelMap?.[k] || k} 
                        stackId="a" 
                        fill={COLORS[i % COLORS.length]} 
                        radius={i === keys.length - 1 ? [8, 8, 0, 0] : [0, 0, 0, 0]} 
                        onClick={(data) => onClick?.(k, data)}
                        style={onClick ? { cursor: 'pointer' } : undefined}
                    />
                ))}
            </BarChart>
        </ResponsiveContainer>
    );
}

export function StackedAreaChart({ data, keys, suffix, labelMap, onClick }: { data: Record<string, any>[], keys: string[], suffix: string, labelMap?: Record<string, string>, onClick?: (key: string, data: any) => void }) {
    const activeKeys = keys.filter(k => data.some(entry => (Number(entry[`${k}${suffix}`]) || 0) > 0));
    
    return (
        <ResponsiveContainer width="100%" height={300} minHeight={250}>
            <AreaChart data={data} margin={{ top: 20, right: 10, left: -25, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 7" vertical={false} stroke={chartGridColor} />
                <XAxis dataKey="time" stroke={chartAxisColor} fontSize={10} tickLine={false} axisLine={false} interval="preserveStartEnd" />
                <YAxis stroke={chartAxisColor} fontSize={10} tickLine={false} axisLine={false} width={45} />
                <Tooltip contentStyle={chartTooltipStyle} labelStyle={chartLabelStyle} itemStyle={chartItemStyle} />
                <Legend wrapperStyle={{ fontSize: '10px', paddingTop: '8px' }} />
                {activeKeys.map((k, i) => (
                    <Area 
                        key={k} 
                        type="monotone" 
                        dataKey={(entry: Record<string, any>) => entry?.[`${k}${suffix}`] || 0} 
                        name={labelMap?.[k] || k} 
                        stackId="1" 
                        stroke={COLORS[i % COLORS.length]} 
                        strokeWidth={2.2} 
                        fill={COLORS[i % COLORS.length]} 
                        fillOpacity={0.22} 
                        onClick={(data) => onClick?.(k, data)}
                        style={onClick ? { cursor: 'pointer' } : undefined}
                    />
                ))}
            </AreaChart>
        </ResponsiveContainer>
    );
}
