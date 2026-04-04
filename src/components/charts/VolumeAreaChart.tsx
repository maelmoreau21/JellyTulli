"use client";

import { useTranslations } from 'next-intl';
import { Area, AreaChart, Tooltip, XAxis, YAxis, CartesianGrid, Legend } from "recharts";
import ResponsiveContainer from "./ResponsiveContainerGuard";
import { chartAxisColor, chartGridColor, chartItemStyle, chartLabelStyle, chartTooltipStyle } from "@/lib/chartTheme";

export type VolumeHourData = {
    name: string;
    Movies: number;
    Series: number;
    Music: number;
    Other: number;
};

export function VolumeAreaChart({ data }: { data: VolumeHourData[] }) {
    const t = useTranslations('charts');

    return (
        <ResponsiveContainer width="100%" height={300} minHeight={300}>
            <AreaChart data={data} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={chartGridColor} />
                <XAxis
                    dataKey="name"
                    stroke={chartAxisColor}
                    fontSize={12}
                    tickLine={false}
                    axisLine={false}
                    tickFormatter={(value) => value}
                />
                <YAxis
                    stroke={chartAxisColor}
                    fontSize={12}
                    tickLine={false}
                    axisLine={false}
                    tickFormatter={(value) => `${value}h`}
                />
                <Tooltip
                    contentStyle={chartTooltipStyle}
                    labelStyle={chartLabelStyle}
                    itemStyle={chartItemStyle}
                />
                <Legend iconType="circle" wrapperStyle={{ fontSize: '12px', paddingTop: '10px' }} />

                <Area type="monotone" dataKey="Other" stackId="1" stroke="#a855f7" fill="#a855f7" fillOpacity={0.12} name={t('otherBooks')} />
                <Area type="monotone" dataKey="Music" stackId="1" stroke="#eab308" fill="#eab308" fillOpacity={0.12} name={t('music')} />
                <Area type="monotone" dataKey="Series" stackId="1" stroke="#10b981" fill="#10b981" fillOpacity={0.12} name={t('series')} />
                <Area type="monotone" dataKey="Movies" stackId="1" stroke="#3b82f6" fill="#3b82f6" fillOpacity={0.12} name={t('movies')} />
            </AreaChart>
        </ResponsiveContainer>
    );
}
