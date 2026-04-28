"use client";

import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { useTranslations } from "next-intl";

export default function SettingsOverviewPage() {
    const t = useTranslations('settings');

    return (
        <div className="p-4 md:p-8 pt-4 md:pt-6 w-full">
            <div className="max-w-[1400px] mx-auto">
                    <div className="flex items-center justify-between mb-6">
                    <h2 className="text-2xl md:text-3xl font-bold tracking-tight">{t('overviewTitle')}</h2>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    <Card className="lg:col-span-2">
                        <CardHeader>
                            <CardTitle>{t('summary')}</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <p className="text-sm text-muted-foreground">{t('overviewSummaryDesc')}</p>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader>
                            <CardTitle>{t('quickActions')}</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <p className="text-sm text-muted-foreground">{t('quickActionsDesc')}</p>
                        </CardContent>
                    </Card>
                </div>
            </div>
        </div>
    );
}
