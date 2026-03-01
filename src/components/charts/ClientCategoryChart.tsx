"use client";

import {
    BarChart,
    Bar,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer,
    Cell,
} from "recharts";

export interface ClientCategoryData {
    category: string; // "TV", "Web", "Mobile", "Desktop", "Autre"
    count: number;
}

interface ClientCategoryChartProps {
    data: ClientCategoryData[];
}

const CATEGORY_COLORS: Record<string, string> = {
    TV: "#6366f1",
    Web: "#3b82f6",
    Mobile: "#22c55e",
    Desktop: "#f59e0b",
    Autre: "#71717a",
};

export function ClientCategoryChart({ data }: ClientCategoryChartProps) {
    return (
        <ResponsiveContainer width="100%" height={280}>
            <BarChart data={data} layout="vertical" margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#333" />
                <XAxis type="number" stroke="#888888" fontSize={11} tickLine={false} axisLine={false} allowDecimals={false} />
                <YAxis type="category" dataKey="category" stroke="#888888" fontSize={12} tickLine={false} axisLine={false} width={70} />
                <Tooltip
                    contentStyle={{
                        backgroundColor: "#18181b",
                        border: "1px solid #27272a",
                        borderRadius: "8px",
                    }}
                    formatter={(value: number) => [`${value} sessions`, "Sessions"]}
                    labelStyle={{ color: "#a1a1aa" }}
                />
                <Bar dataKey="count" radius={[0, 4, 4, 0]} barSize={24}>
                    {data.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={CATEGORY_COLORS[entry.category] || "#71717a"} />
                    ))}
                </Bar>
            </BarChart>
        </ResponsiveContainer>
    );
}

/**
 * Categorize a Jellyfin client name into a device category.
 */
/**
 * Note: categorizeClient() has been moved to @/lib/utils
 * to allow server-side usage. Import it from there.
 */
