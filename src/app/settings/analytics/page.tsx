import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";

export default function SettingsAnalyticsPage() {
    return (
        <div className="p-4 md:p-8 pt-4 md:pt-6 w-full">
            <div className="max-w-[1400px] mx-auto">
                <div className="flex items-center justify-between mb-6">
                    <h2 className="text-2xl md:text-3xl font-bold tracking-tight">Analyses détaillées</h2>
                </div>

                <div className="space-y-6">
                    <Card>
                        <CardHeader>
                            <CardTitle>Graphiques et tableaux</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <p className="text-sm text-muted-foreground">Emplacement pour affichage des analyses détaillées (historiques, tendances, export).</p>
                        </CardContent>
                    </Card>
                </div>
            </div>
        </div>
    );
}
