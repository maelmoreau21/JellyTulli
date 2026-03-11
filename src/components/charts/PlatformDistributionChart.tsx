"use client";

import { useState } from "react";
import { useTranslations } from 'next-intl';
import {
    PieChart,
    Pie,
    Cell,
    ResponsiveContainer,
    Tooltip,
    Legend,
    Sector,
} from "recharts";
import { chartItemStyle, chartLabelStyle, chartPalette, chartTooltipStyle } from "@/lib/chartTheme";

export interface PlatformData {
    name: string;
    value: number;
}

interface PlatformDistributionChartProps {
    data: PlatformData[];
}

const COLORS = chartPalette;

/* Animated active shape — sector expands + center label */
function renderActiveShape(props: any) {
    const { cx, cy, innerRadius, outerRadius, startAngle, endAngle, fill, payload, value, percent } = props;
    return (
        <g>
            {/* Expanded sector */}
            <Sector
                cx={cx} cy={cy}
                innerRadius={innerRadius - 2}
                outerRadius={outerRadius + 8}
                startAngle={startAngle} endAngle={endAngle}
                fill={fill}
                style={{ filter: "drop-shadow(0 0 8px rgba(56, 189, 248, 0.4))", transition: "all 200ms ease" }}
            />
            {/* Center label — name */}
            <text x={cx} y={cy - 8} textAnchor="middle" fill="#e5eefb" fontSize={13} fontWeight={600}>
                {payload.name}
            </text>
            {/* Center label — value + percent */}
            <text x={cx} y={cy + 12} textAnchor="middle" fill="#94a3b8" fontSize={11}>
                {value} ({(percent * 100).toFixed(0)}%)
            </text>
        </g>
    );
}

export function PlatformDistributionChart({ data }: PlatformDistributionChartProps) {
    const t = useTranslations('charts');
    const [activeIndex, setActiveIndex] = useState<number>(-1);

    if (!data || data.length === 0) {
        return (
            <div className="flex h-[300px] w-full items-center justify-center text-sm text-muted-foreground">
                {t('noPlatformData')}
            </div>
        );
    }

    return (
        <ResponsiveContainer width="100%" height={300} minHeight={300}>
            <PieChart>
                <Pie
                    data={data}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={90}
                    paddingAngle={5}
                    dataKey="value"
                    stroke="none"
                    animationDuration={1000}
                    animationBegin={0}
                    animationEasing="ease-out"
                    {...{
                        activeIndex: activeIndex >= 0 ? activeIndex : undefined,
                        activeShape: renderActiveShape,
                        onMouseEnter: (_: any, index: number) => setActiveIndex(index),
                        onMouseLeave: () => setActiveIndex(-1),
                    } as any}
                >
                    {data.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} style={{ cursor: "pointer" }} />
                    ))}
                </Pie>
                <Tooltip
                    contentStyle={chartTooltipStyle}
                    labelStyle={chartLabelStyle}
                    itemStyle={chartItemStyle}
                    animationDuration={200}
                />
                <Legend
                    verticalAlign="bottom"
                    height={36}
                    iconType="circle"
                    wrapperStyle={{ fontSize: '12px', cursor: 'pointer' }}
                />
            </PieChart>
        </ResponsiveContainer>
    );
}
