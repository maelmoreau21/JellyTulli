import { Skeleton } from "@/components/ui/skeleton";

export default function DashboardLoading() {
    return (
        <div className="flex-col md:flex">
            <div className="flex-1 space-y-4 md:space-y-6 p-4 md:p-8 pt-4 md:pt-6">
                {/* Header skeleton */}
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 mb-4">
                    <div className="flex items-center gap-6">
                        <Skeleton className="h-9 w-40" />
                        <Skeleton className="h-9 w-[380px]" />
                    </div>
                    <Skeleton className="h-9 w-48" />
                </div>

                {/* Today Banner skeleton */}
                <Skeleton className="h-12 w-full rounded-xl" />

                {/* KPI Cards Row */}
                <div className="grid gap-4 md:grid-cols-3 lg:grid-cols-5">
                    {Array.from({ length: 5 }).map((_, i) => (
                        <Skeleton key={i} className="h-[120px] rounded-xl" />
                    ))}
                </div>

                {/* Category Cards Row */}
                <div className="grid gap-4 md:grid-cols-4">
                    {Array.from({ length: 4 }).map((_, i) => (
                        <Skeleton key={i} className="h-[100px] rounded-xl" />
                    ))}
                </div>

                {/* Charts Row */}
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
                    <Skeleton className="col-span-1 lg:col-span-5 h-[440px] rounded-xl" />
                    <Skeleton className="col-span-1 lg:col-span-2 h-[440px] rounded-xl" />
                </div>

                {/* Library Plays + Heatmap skeletons */}
                <Skeleton className="h-[400px] w-full rounded-xl" />
                <Skeleton className="h-[250px] w-full rounded-xl" />
            </div>
        </div>
    );
}
