"use client";

import {
    AreaChart,
    Area,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
} from "recharts";
import ResponsiveContainer from "./charts/ResponsiveContainerGuard";

interface ChartDataPoint {
    name: string;
    hours: number;
}

interface DashboardChartProps {
    data: ChartDataPoint[];
}

export function DashboardChart({ data }: DashboardChartProps) {
    return (
        <ResponsiveContainer width="100%" height={300} minHeight={300}>
            <AreaChart
                data={data}
                margin={{
                    top: 10,
                    right: 30,
                    left: 0,
                    bottom: 0,
                }}
            >
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#333" />
                <XAxis
                    dataKey="name"
                    stroke="#888888"
                    fontSize={12}
                    tickLine={false}
                    axisLine={false}
                />
                <YAxis
                    stroke="#888888"
                    fontSize={12}
                    tickLine={false}
                    axisLine={false}
                    tickFormatter={(value) => `${value}h`}
                />
                <Tooltip
                    contentStyle={{ backgroundColor: "#18181b", border: "1px solid #27272a", borderRadius: "8px", color: "#f4f4f5" }}
                    labelStyle={{ color: "#a1a1aa" }}
                    itemStyle={{ color: "#e4e4e7" }}
                />
                <Area
                    type="monotone"
                    dataKey="hours"
                    stroke="#8884d8"
                    fillOpacity={0.2}
                    fill="#8884d8"
                />
            </AreaChart>
        </ResponsiveContainer>
    );
}
