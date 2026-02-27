"use client";

import {
    BarChart,
    Bar,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer,
    Cell
} from "recharts";

export interface ActivityHourData {
    hour: string; // "00:00", "01:00", etc.
    count: number;
}

interface ActivityByHourChartProps {
    data: ActivityHourData[];
}

export function ActivityByHourChart({ data }: ActivityByHourChartProps) {
    // Find max value to color it differently
    const maxCount = Math.max(...data.map(d => d.count), 0);

    return (
        <ResponsiveContainer width="100%" height={300} minHeight={300}>
            <BarChart
                data={data}
                margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
            >
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#333" />
                <XAxis
                    dataKey="hour"
                    stroke="#888888"
                    fontSize={10}
                    tickLine={false}
                    axisLine={false}
                    interval="preserveStartEnd"
                />
                <YAxis
                    stroke="#888888"
                    fontSize={10}
                    tickLine={false}
                    axisLine={false}
                    allowDecimals={false}
                />
                <Tooltip
                    contentStyle={{ backgroundColor: "#18181b", border: "1px solid #27272a", borderRadius: "8px" }}
                    itemStyle={{ color: "#fff" }}
                    cursor={{ fill: '#27272a' }}
                />
                <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                    {data.map((entry, index) => (
                        <Cell
                            key={`cell-${index}`}
                            fill={entry.count === maxCount && maxCount > 0 ? "#f97316" : "#6366f1"}
                            className="transition-all duration-300"
                        />
                    ))}
                </Bar>
            </BarChart>
        </ResponsiveContainer>
    );
}
