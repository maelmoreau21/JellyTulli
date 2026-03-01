"use client";

import {
    PieChart,
    Pie,
    Cell,
    ResponsiveContainer,
    Tooltip,
    Legend,
} from "recharts";

export interface CompletionData {
    name: string;
    value: number;
}

interface CompletionRatioChartProps {
    data: CompletionData[];
}

const COLORS: Record<string, string> = {
    "Terminé": "#22c55e",
    "Abandonné": "#ef4444",
    "Partiel": "#f59e0b",
};

export function CompletionRatioChart({ data }: CompletionRatioChartProps) {
    return (
        <ResponsiveContainer width="100%" height={280}>
            <PieChart>
                <Pie
                    data={data}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={90}
                    paddingAngle={3}
                    dataKey="value"
                    nameKey="name"
                    strokeWidth={0}
                >
                    {data.map((entry, index) => (
                        <Cell
                            key={`cell-${index}`}
                            fill={COLORS[entry.name] || "#71717a"}
                        />
                    ))}
                </Pie>
                <Tooltip
                    contentStyle={{
                        backgroundColor: "#18181b",
                        border: "1px solid #27272a",
                        borderRadius: "8px",
                    }}
                    formatter={(value: number, name: string) => [
                        `${value} sessions`,
                        name,
                    ]}
                />
                <Legend
                    wrapperStyle={{ fontSize: "12px", color: "#a1a1aa" }}
                    iconType="circle"
                />
            </PieChart>
        </ResponsiveContainer>
    );
}
