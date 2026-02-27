"use client";

import {
    AreaChart,
    Area,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer,
} from "recharts";

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
                <defs>
                    <linearGradient id="colorHours" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#8884d8" stopOpacity={0.8} />
                        <stop offset="95%" stopColor="#8884d8" stopOpacity={0} />
                    </linearGradient>
                </defs>
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
                    contentStyle={{ backgroundColor: "#1f2937", border: "none", borderRadius: "8px" }}
                    itemStyle={{ color: "#fff" }}
                />
                <Area
                    type="monotone"
                    dataKey="hours"
                    stroke="#8884d8"
                    fillOpacity={1}
                    fill="url(#colorHours)"
                />
            </AreaChart>
        </ResponsiveContainer>
    );
}
