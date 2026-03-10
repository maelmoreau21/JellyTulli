import { Skeleton } from "@/components/ui/skeleton";

export default function UsersLoading() {
    return (
        <div className="flex-col md:flex">
            <div className="flex-1 space-y-4 md:space-y-6 p-4 md:p-8 pt-4 md:pt-6">
                {/* Header */}
                <Skeleton className="h-9 w-48" />

                {/* Table skeleton */}
                <div className="space-y-2">
                    <Skeleton className="h-10 w-full rounded-lg" />
                    {Array.from({ length: 8 }).map((_, i) => (
                        <Skeleton key={i} className="h-16 w-full rounded-lg" />
                    ))}
                </div>
            </div>
        </div>
    );
}
