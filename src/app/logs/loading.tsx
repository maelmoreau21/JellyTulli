import { Skeleton } from "@/components/ui/skeleton";

export default function LogsLoading() {
    return (
        <div className="flex-col md:flex">
            <div className="flex-1 space-y-4 md:space-y-6 p-4 md:p-8 pt-4 md:pt-6">
                {/* Header */}
                <div className="flex items-center justify-between">
                    <Skeleton className="h-9 w-48" />
                    <Skeleton className="h-9 w-32" />
                </div>

                {/* Filters Row */}
                <div className="flex gap-3">
                    <Skeleton className="h-10 w-64" />
                    <Skeleton className="h-10 w-32" />
                    <Skeleton className="h-10 w-24" />
                </div>

                {/* Table skeleton */}
                <div className="space-y-2">
                    <Skeleton className="h-10 w-full rounded-lg" />
                    {Array.from({ length: 10 }).map((_, i) => (
                        <Skeleton key={i} className="h-14 w-full rounded-lg" />
                    ))}
                </div>

                {/* Pagination */}
                <div className="flex justify-center">
                    <Skeleton className="h-9 w-64" />
                </div>
            </div>
        </div>
    );
}
