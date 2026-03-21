import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";

export default function SettingsOverviewPage() {
    return (
        <div className="p-4 md:p-8 pt-4 md:pt-6 w-full">
            <div className="max-w-[1400px] mx-auto">
                <div className="flex items-center justify-between mb-6">
                    <h2 className="text-2xl md:text-3xl font-bold tracking-tight">Vue d'ensemble</h2>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    <Card className="lg:col-span-2">
                        <CardHeader>
                            <CardTitle>Résumé</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <p className="text-sm text-muted-foreground">Résumé rapide des paramètres et états (ex : plugin connecté, sauvegardes récentes, tâches planifiées).</p>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader>
                            <CardTitle>Actions rapides</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <p className="text-sm text-muted-foreground">Boutons et raccourcis pour les actions fréquentes.</p>
                        </CardContent>
                    </Card>
                </div>
            </div>
        </div>
    );
}
