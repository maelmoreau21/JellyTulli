import { Skeleton } from "@/components/ui/skeleton";

export default function SettingsLoading() {
    return (
        <div className="flex-col md:flex">
            <div className="flex-1 space-y-4 md:space-y-6 p-4 md:p-8 pt-4 md:pt-6">
                {/* Header */}
                <Skeleton className="h-9 w-48" />

                {/* Settings cards */}
                <div className="grid gap-6 md:grid-cols-2">
                    {Array.from({ length: 4 }).map((_, i) => (
                        <Skeleton key={i} className="h-[200px] rounded-xl" />
                    ))}
                </div>
            </div>
        </div>
    );
}
