"use client";

import React from "react";
import Link from "next/link";
import { Plug, Zap, Save, Database, Download, Clock } from "lucide-react";
import { useTranslations } from "next-intl";

export default function SettingsLayout({ children }: { children: React.ReactNode }) {
    const t = useTranslations('settings');

    return (
        <div className="flex-col md:flex">
            <div className="flex-1 p-4 md:p-8 pt-4 md:pt-6 w-full">
                <div className="w-full">
                    <div className="flex gap-6">
                        <aside className="w-64 hidden lg:block shrink-0">
                            <div className="sticky top-20 space-y-4">
                                <div className="text-sm font-semibold text-zinc-400">{t('title')}</div>
                                <nav className="space-y-1 mt-2">
                                    <Link href="/settings/plugin" className="flex items-center gap-2 px-3 py-2 rounded hover:bg-zinc-100 dark:hover:bg-zinc-800"><Plug className="w-4 h-4" /> {t('pluginTitle')}</Link>
                                    <Link href="/settings/scheduler" className="flex items-center gap-2 px-3 py-2 rounded hover:bg-zinc-100 dark:hover:bg-zinc-800"><Zap className="w-4 h-4" /> {t('taskScheduler')}</Link>
                                    <Link href="/settings/notifications" className="flex items-center gap-2 px-3 py-2 rounded hover:bg-zinc-100 dark:hover:bg-zinc-800"><Save className="w-4 h-4" /> {t('notifications')}</Link>
                                    <Link href="/settings/libraryRules" className="flex items-center gap-2 px-3 py-2 rounded hover:bg-zinc-100 dark:hover:bg-zinc-800"><Database className="w-4 h-4" /> {t('libraryRules')}</Link>
                                    <Link href="/settings/dataBackups" className="flex items-center gap-2 px-3 py-2 rounded hover:bg-zinc-100 dark:hover:bg-zinc-800"><Download className="w-4 h-4" /> {t('dataBackups')}</Link>
                                    <Link href="/settings/backupManagement" className="flex items-center gap-2 px-3 py-2 rounded hover:bg-zinc-100 dark:hover:bg-zinc-800"><Clock className="w-4 h-4" /> {t('backupManagement')}</Link>
                                "use client";

                                import React from "react";
                                import Link from "next/link";
                                import { Plug, Zap, Save, Database, Download, Clock } from "lucide-react";
                                import { useTranslations } from "next-intl";

                                export default function SettingsLayout({ children }: { children: React.ReactNode }) {
                                    const t = useTranslations('settings');

                                    return (
                                        <div className="flex-col md:flex">
                                            <div className="flex-1 p-4 md:p-8 pt-4 md:pt-6 w-full">
                                                <div className="w-full">
                                                    <div className="flex gap-6">
                                                        <aside className="w-64 hidden lg:block shrink-0">
                                                            <div className="sticky top-20 space-y-4">
                                                                <div className="text-sm font-semibold text-zinc-400">{t('title')}</div>
                                                                <nav className="space-y-1 mt-2">
                                                                    <Link href="/settings/plugin" className="flex items-center gap-2 px-3 py-2 rounded hover:bg-zinc-100 dark:hover:bg-zinc-800"><Plug className="w-4 h-4" /> {t('pluginTitle')}</Link>
                                                                    <Link href="/settings/scheduler" className="flex items-center gap-2 px-3 py-2 rounded hover:bg-zinc-100 dark:hover:bg-zinc-800"><Zap className="w-4 h-4" /> {t('taskScheduler')}</Link>
                                                                    <Link href="/settings/notifications" className="flex items-center gap-2 px-3 py-2 rounded hover:bg-zinc-100 dark:hover:bg-zinc-800"><Save className="w-4 h-4" /> {t('notifications')}</Link>
                                                                    <Link href="/settings/libraryRules" className="flex items-center gap-2 px-3 py-2 rounded hover:bg-zinc-100 dark:hover:bg-zinc-800"><Database className="w-4 h-4" /> {t('libraryRules')}</Link>
                                                                    <Link href="/settings/dataBackups" className="flex items-center gap-2 px-3 py-2 rounded hover:bg-zinc-100 dark:hover:bg-zinc-800"><Download className="w-4 h-4" /> {t('dataBackups')}</Link>
                                                                    <Link href="/settings/backupManagement" className="flex items-center gap-2 px-3 py-2 rounded hover:bg-zinc-100 dark:hover:bg-zinc-800"><Clock className="w-4 h-4" /> {t('backupManagement')}</Link>
                                                                </nav>
                                                            </div>
                                                        </aside>
                                                        <main className="flex-1 space-y-4 md:space-y-6">
                                                            {children}
                                                        </main>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    );
                                }
