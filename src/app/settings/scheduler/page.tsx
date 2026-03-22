"use client";

import SchedulerTasksPage from "./tasks/page";
import SchedulerSchedulesPage from "./schedules/page";

export default function SettingsSchedulerPage() {
    return (
        <div className="p-4 md:p-8 max-w-[1100px] mx-auto space-y-6">
            <SchedulerTasksPage />
            <SchedulerSchedulesPage />
        </div>
    );
}
