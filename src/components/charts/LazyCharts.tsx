"use client";

/**
 * Lazy-loaded chart wrappers for the Dashboard.
 * 
 * Recharts is a heavy library (~200KB gzipped). By using next/dynamic with ssr: false,
 * these charts are loaded AFTER the initial HTML renders, making the page interactive faster.
 * The user sees animated skeleton placeholders while charts load in the background.
 */

import dynamic from "next/dynamic";

const ChartSkeleton = ({ height = 300 }: { height?: number }) => (
    <div
        className="animate-pulse bg-zinc-800/50 rounded-lg w-full"
        style={{ height }}
    />
);

// --- Dashboard Overview Charts ---

export const LazyComposedTrendChart = dynamic(
    () => import("@/components/charts/ComposedTrendChart").then((m) => ({ default: m.ComposedTrendChart })),
    { ssr: false, loading: () => <ChartSkeleton height={400} /> }
);

export const LazyCategoryPieChart = dynamic(
    () => import("@/components/charts/CategoryPieChart").then((m) => ({ default: m.CategoryPieChart })),
    { ssr: false, loading: () => <ChartSkeleton height={300} /> }
);

export const LazyLibraryDailyPlaysChart = dynamic(
    () => import("@/components/charts/LibraryDailyPlaysChart").then((m) => ({ default: m.LibraryDailyPlaysChart })),
    { ssr: false, loading: () => <ChartSkeleton height={350} /> }
);

export const LazyActivityByHourChart = dynamic(
    () => import("@/components/charts/ActivityByHourChart").then((m) => ({ default: m.ActivityByHourChart })),
    { ssr: false, loading: () => <ChartSkeleton height={250} /> }
);

export const LazyDayOfWeekChart = dynamic(
    () => import("@/components/charts/DayOfWeekChart").then((m) => ({ default: m.DayOfWeekChart })),
    { ssr: false, loading: () => <ChartSkeleton height={250} /> }
);

export const LazyMonthlyWatchTimeChart = dynamic(
    () => import("@/components/charts/MonthlyWatchTimeChart").then((m) => ({ default: m.MonthlyWatchTimeChart })),
    { ssr: false, loading: () => <ChartSkeleton height={300} /> }
);

export const LazyCompletionRatioChart = dynamic(
    () => import("@/components/charts/CompletionRatioChart").then((m) => ({ default: m.CompletionRatioChart })),
    { ssr: false, loading: () => <ChartSkeleton height={280} /> }
);

export const LazyClientCategoryChart = dynamic(
    () => import("@/components/charts/ClientCategoryChart").then((m) => ({ default: m.ClientCategoryChart })),
    { ssr: false, loading: () => <ChartSkeleton height={280} /> }
);

export const LazyPlatformDistributionChart = dynamic(
    () => import("@/components/charts/PlatformDistributionChart").then((m) => ({ default: m.PlatformDistributionChart })),
    { ssr: false, loading: () => <ChartSkeleton height={300} /> }
);
