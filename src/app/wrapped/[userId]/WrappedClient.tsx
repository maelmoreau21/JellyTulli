"use client";

import { useState, useEffect } from "react";
import { ChevronRight, ChevronLeft, Share2, Play, Star, Calendar, Clock, X, Film, Tv, Music, BarChart3, TrendingUp, Headphones } from "lucide-react";
import { useRouter } from "next/navigation";

interface CategoryBreakdown {
    totalSeconds: number;
    totalHours: number;
    topMedia: { title: string; seconds: number }[];
}

interface WrappedData {
    username: string;
    year: number;
    totalHours: number;
    topMedia: { title: string; seconds: number }[];
    topGenres: { name: string; count: number }[];
    topGenre: string;
    topDay: string;
    peakHour: string;
    peakHourSessions: number;
    monthlyHours: { name: string; hours: number }[];
    topSeries: { title: string; seconds: number }[];
    topArtists: { title: string; seconds: number }[];
    totalSessions: number;
    categories: {
        movies: CategoryBreakdown;
        series: CategoryBreakdown;
        music: CategoryBreakdown;
    };
}

function formatDuration(seconds: number): string {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    if (h > 0) return `${h}h${m > 0 ? ` ${m}min` : ""}`;
    return `${m}min`;
}

function RankedList({ items, gradient }: { items: { title: string; seconds: number }[]; gradient: string }) {
    if (items.length === 0) return <p className="text-zinc-400 text-center">Aucune donnée.</p>;
    const maxSeconds = items[0].seconds;
    return (
        <div className="flex flex-col w-full gap-3">
            {items.map((m, i) => (
                <div key={i} className="relative p-4 bg-white/10 rounded-xl backdrop-blur-md overflow-hidden">
                    <div className={`absolute inset-0 ${gradient} opacity-10`} style={{ width: `${Math.round((m.seconds / maxSeconds) * 100)}%` }} />
                    <div className="flex items-center relative z-10">
                        <span className="text-2xl font-bold text-white/40 w-8 shrink-0">{i + 1}</span>
                        <span className="text-lg font-bold text-white truncate flex-1">{m.title}</span>
                        <span className="text-sm text-zinc-400 ml-2 shrink-0">{formatDuration(m.seconds)}</span>
                    </div>
                </div>
            ))}
        </div>
    );
}

function CategorySlide({ label, icon, breakdown, gradient }: { label: string; icon: React.ReactNode; breakdown: CategoryBreakdown; gradient: string }) {
    if (breakdown.topMedia.length === 0) {
        return (
            <div className="flex flex-col items-center gap-4">
                <p className="text-zinc-400">Aucune donnée pour {label.toLowerCase()} cette année.</p>
            </div>
        );
    }
    return (
        <div className="flex flex-col items-center gap-6 w-full max-w-md px-6">
            <div className="flex items-center gap-3">
                {icon}
                <span className={`text-3xl font-black text-transparent bg-clip-text ${gradient}`}>
                    {breakdown.totalHours}h
                </span>
                <span className="text-zinc-300 text-lg">de {label}</span>
            </div>
            <RankedList items={breakdown.topMedia} gradient={gradient} />
        </div>
    );
}

function MonthlyChart({ data }: { data: { name: string; hours: number }[] }) {
    const maxHours = Math.max(...data.map(d => d.hours), 1);
    return (
        <div className="flex items-end gap-1.5 h-40 w-full max-w-md px-2">
            {data.map((d, i) => (
                <div key={i} className="flex-1 flex flex-col items-center gap-1">
                    <span className="text-[10px] text-zinc-400 font-bold">{d.hours > 0 ? `${d.hours}h` : ""}</span>
                    <div className="w-full rounded-t-md bg-gradient-to-t from-purple-500/80 to-fuchsia-400/80 transition-all duration-700"
                        style={{ height: `${Math.max(2, (d.hours / maxHours) * 100)}%` }} />
                    <span className="text-[9px] text-zinc-500">{d.name}</span>
                </div>
            ))}
        </div>
    );
}

function GenreChart({ genres }: { genres: { name: string; count: number }[] }) {
    if (genres.length === 0) return null;
    const maxCount = genres[0].count;
    const colors = ["from-pink-500 to-rose-400", "from-purple-500 to-violet-400", "from-sky-500 to-blue-400", "from-emerald-500 to-green-400", "from-amber-500 to-yellow-400"];
    return (
        <div className="flex flex-col gap-3 w-full max-w-md px-6">
            {genres.map((g, i) => (
                <div key={g.name} className="flex items-center gap-3">
                    <span className="w-24 truncate text-sm font-medium text-zinc-200 text-right">{g.name}</span>
                    <div className="flex-1 h-6 bg-white/10 rounded-full overflow-hidden">
                        <div className={`h-full bg-gradient-to-r ${colors[i % colors.length]} rounded-full transition-all duration-700`}
                            style={{ width: `${Math.round((g.count / maxCount) * 100)}%` }} />
                    </div>
                    <span className="text-xs text-zinc-400 w-8">{g.count}</span>
                </div>
            ))}
        </div>
    );
}

export default function WrappedClient({ data }: { data: WrappedData }) {
    const [currentSlide, setCurrentSlide] = useState(0);
    const router = useRouter();

    const slides = [
        // 0 - Intro
        {
            title: `JellyTulli Wrapped ${data.year}`,
            subtitle: `C'est l'heure du bilan, ${data.username}.`,
            icon: <Play className="w-16 h-16 mb-6 text-white animate-pulse" />,
            bgColor: "bg-gradient-to-br from-indigo-900 via-purple-900 to-black",
            content: <p className="text-xl text-center text-zinc-300 max-w-sm">Prêt à découvrir tes statistiques de cette année ?</p>
        },
        // 1 - Total watch time
        {
            title: "Un temps infiniment bien dépensé.",
            subtitle: "Temps total de visionnage",
            icon: <Clock className="w-16 h-16 mb-4 text-emerald-400" />,
            bgColor: "bg-gradient-to-br from-emerald-900 via-teal-900 to-black",
            content: (
                <div className="flex flex-col items-center">
                    <span className="text-7xl font-black text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 to-cyan-400 mb-2">
                        {data.totalHours}
                    </span>
                    <span className="text-2xl font-semibold text-zinc-200">Heures</span>
                    <p className="mt-4 text-zinc-400">réparties sur <span className="text-white font-bold">{data.totalSessions}</span> sessions.</p>
                </div>
            )
        },
        // 2 - Monthly breakdown
        {
            title: "Ton année, mois par mois.",
            subtitle: "Heures de visionnage",
            icon: <BarChart3 className="w-16 h-16 mb-4 text-fuchsia-400" />,
            bgColor: "bg-gradient-to-br from-fuchsia-900 via-purple-900 to-black",
            content: (
                <div className="flex flex-col items-center gap-4 w-full">
                    <MonthlyChart data={data.monthlyHours} />
                    {(() => {
                        const best = data.monthlyHours.reduce((a, b) => b.hours > a.hours ? b : a, data.monthlyHours[0]);
                        return best && best.hours > 0
                            ? <p className="text-zinc-400 text-sm">Ton meilleur mois : <span className="text-white font-bold">{best.name}</span> avec <span className="text-fuchsia-400 font-bold">{best.hours}h</span></p>
                            : null;
                    })()}
                </div>
            )
        },
        // 3 - Peak hour
        {
            title: "Tu es plutôt du genre…",
            subtitle: "Heure de pointe",
            icon: <TrendingUp className="w-16 h-16 mb-4 text-orange-400" />,
            bgColor: "bg-gradient-to-br from-orange-900 via-red-900 to-black",
            content: (
                <div className="flex flex-col items-center">
                    <span className="text-6xl font-black text-transparent bg-clip-text bg-gradient-to-r from-orange-400 to-red-400 mb-2">
                        {data.peakHour}
                    </span>
                    <p className="mt-2 text-zinc-400 text-center max-w-sm">
                        C'est l'heure à laquelle tu lances le plus de sessions (<span className="text-white font-bold">{data.peakHourSessions}</span>).
                    </p>
                </div>
            )
        },
        // 4 - Top genres
        {
            title: "Ton ADN culturel.",
            subtitle: "Top genres",
            icon: <Star className="w-16 h-16 mb-4 text-pink-400" />,
            bgColor: "bg-gradient-to-br from-pink-900 via-rose-900 to-black",
            content: (
                <div className="flex flex-col items-center gap-4 w-full">
                    <span className="text-4xl font-black text-transparent bg-clip-text bg-gradient-to-r from-pink-400 to-orange-400 mb-2 text-center uppercase tracking-wider">
                        {data.topGenre}
                    </span>
                    <p className="text-zinc-400 text-sm mb-2">est ton genre n°1. Voici le top complet :</p>
                    <GenreChart genres={data.topGenres} />
                </div>
            )
        },
        // 5 - Top day
        {
            title: "Ton marathon personnel.",
            subtitle: "Jour le plus actif",
            icon: <Calendar className="w-16 h-16 mb-4 text-amber-400" />,
            bgColor: "bg-gradient-to-br from-amber-900 via-orange-900 to-black",
            content: (
                <div className="flex flex-col items-center">
                    <span className="text-5xl font-black text-transparent bg-clip-text bg-gradient-to-r from-amber-400 to-yellow-400 mb-2">
                        Le {data.topDay}
                    </span>
                    <p className="mt-4 text-zinc-400 text-center max-w-sm">Ton jour préféré pour te poser devant un bon média.</p>
                </div>
            )
        },
        // 6 - Top 5 all media
        {
            title: "Le Panthéon.",
            subtitle: "Top 5 — Toutes catégories",
            icon: <Star className="w-12 h-12 mb-4 text-yellow-500" />,
            bgColor: "bg-gradient-to-br from-blue-900 via-indigo-900 to-black",
            content: (
                <div className="w-full max-w-md px-6">
                    <RankedList items={data.topMedia} gradient="bg-gradient-to-r from-indigo-500 to-blue-400" />
                </div>
            )
        },
        // 7 - Top Series (conditional)
        ...(data.topSeries.length > 0 ? [{
            title: "Binge Watching.",
            subtitle: "Top Séries",
            icon: <Tv className="w-16 h-16 mb-4 text-sky-400" />,
            bgColor: "bg-gradient-to-br from-sky-900 via-blue-900 to-black",
            content: (
                <div className="w-full max-w-md px-6">
                    <RankedList items={data.topSeries} gradient="bg-gradient-to-r from-sky-500 to-blue-400" />
                </div>
            )
        }] : []),
        // 8 - Top Artists (conditional)
        ...(data.topArtists.length > 0 ? [{
            title: "Tes Artistes Préférés.",
            subtitle: "Top Albums / Artistes",
            icon: <Headphones className="w-16 h-16 mb-4 text-green-400" />,
            bgColor: "bg-gradient-to-br from-green-900 via-emerald-900 to-black",
            content: (
                <div className="w-full max-w-md px-6">
                    <RankedList items={data.topArtists} gradient="bg-gradient-to-r from-green-500 to-emerald-400" />
                </div>
            )
        }] : []),
        // Category slides
        {
            title: "Le Grand Écran.",
            subtitle: "Top Films",
            icon: <Film className="w-16 h-16 mb-4 text-red-400" />,
            bgColor: "bg-gradient-to-br from-red-900 via-rose-900 to-black",
            content: <CategorySlide label="Films" icon={<Film className="w-8 h-8 text-red-400" />} breakdown={data.categories.movies} gradient="bg-gradient-to-r from-red-400 to-orange-400" />
        },
        {
            title: "Épisodes Favoris.",
            subtitle: "Top Épisodes",
            icon: <Tv className="w-16 h-16 mb-4 text-sky-400" />,
            bgColor: "bg-gradient-to-br from-sky-900 via-blue-900 to-black",
            content: <CategorySlide label="Séries" icon={<Tv className="w-8 h-8 text-sky-400" />} breakdown={data.categories.series} gradient="bg-gradient-to-r from-sky-400 to-blue-400" />
        },
        {
            title: "La Bande Son.",
            subtitle: "Top Musique",
            icon: <Music className="w-16 h-16 mb-4 text-green-400" />,
            bgColor: "bg-gradient-to-br from-green-900 via-emerald-900 to-black",
            content: <CategorySlide label="Musique" icon={<Music className="w-8 h-8 text-green-400" />} breakdown={data.categories.music} gradient="bg-gradient-to-r from-green-400 to-emerald-400" />
        },
        // Share card
        {
            title: "C'est dans la boîte.",
            subtitle: "Raconte-le au monde.",
            icon: <Share2 className="w-16 h-16 mb-4 text-fuchsia-400" />,
            bgColor: "bg-gradient-to-br from-purple-900 via-fuchsia-900 to-black",
            content: (
                <div className="flex flex-col items-center gap-6">
                    <div className="p-6 bg-black/40 rounded-2xl border border-white/10 backdrop-blur-xl flex flex-col items-center text-center max-w-sm">
                        <p className="text-sm text-zinc-400 mb-1">JellyTulli Wrapped {data.year}</p>
                        <h3 className="text-2xl font-bold text-white mb-4">{data.username}</h3>
                        <p className="text-fuchsia-400 font-bold text-lg">{data.totalHours}h de stream</p>
                        <p className="text-zinc-300 text-sm mt-1">🏆 Genre : {data.topGenre}</p>
                        <p className="text-zinc-300 text-sm">⏰ Pic : {data.peakHour}</p>
                        <p className="text-zinc-300 text-sm">📅 Jour favori : {data.topDay}</p>
                        <div className="flex gap-4 mt-3 text-xs text-zinc-400">
                            {data.categories.movies.totalHours > 0 && <span>🎬 {data.categories.movies.totalHours}h</span>}
                            {data.categories.series.totalHours > 0 && <span>📺 {data.categories.series.totalHours}h</span>}
                            {data.categories.music.totalHours > 0 && <span>🎵 {data.categories.music.totalHours}h</span>}
                        </div>
                    </div>
                    <p className="text-xs text-zinc-500">Capture cet écran pour partager.</p>
                </div>
            )
        }
    ];

    const nextSlide = () => {
        if (currentSlide < slides.length - 1) setCurrentSlide(c => c + 1);
    };

    const prevSlide = () => {
        if (currentSlide > 0) setCurrentSlide(c => c - 1);
    };

    // Auto-advance (stories)
    useEffect(() => {
        const timer = setTimeout(() => {
            if (currentSlide < slides.length - 1) setCurrentSlide(c => c + 1);
        }, 8000);
        return () => clearTimeout(timer);
    }, [currentSlide, slides.length]);

    const current = slides[currentSlide];

    return (
        <div className={`fixed inset-0 z-50 flex flex-col text-white transition-colors duration-700 ease-in-out ${current.bgColor}`}>
            {/* Progress Bars */}
            <div className="absolute top-0 left-0 right-0 p-4 flex gap-1.5 z-50">
                {slides.map((_, i) => (
                    <div key={i} className="flex-1 h-1.5 bg-white/20 rounded-full overflow-hidden">
                        <div
                            className={`h-full bg-white transition-all duration-100 ease-linear ${i === currentSlide ? 'w-full animate-[progress_8s_linear]' : i < currentSlide ? 'w-full' : 'w-0'}`}
                        />
                    </div>
                ))}
            </div>

            {/* Close */}
            <button onClick={() => router.back()} className="absolute top-8 right-4 p-2 z-50 rounded-full bg-white/10 hover:bg-white/20 transition backdrop-blur">
                <X className="w-5 h-5 text-white" />
            </button>

            {/* Tap areas */}
            <div className="absolute inset-0 z-40 flex">
                <div className="w-1/3 h-full cursor-pointer" onClick={prevSlide} />
                <div className="w-2/3 h-full cursor-pointer" onClick={nextSlide} />
            </div>

            {/* Content */}
            <div className="flex-1 flex flex-col items-center justify-center p-6 text-center z-30 pointer-events-none overflow-y-auto">
                <style jsx>{`
                    @keyframes progress {
                        from { width: 0%; }
                        to { width: 100%; }
                    }
                `}</style>
                <div className="animate-in fade-in slide-in-from-bottom-8 duration-700 ease-out flex flex-col items-center w-full" key={currentSlide}>
                    {current.icon}
                    <h2 className="text-xl font-bold tracking-widest text-zinc-400 uppercase mb-2">{current.subtitle}</h2>
                    <h1 className="text-4xl md:text-5xl font-black tracking-tight mb-8 leading-tight max-w-2xl">{current.title}</h1>
                    {current.content}
                </div>
            </div>

            {/* Bottom controls */}
            <div className="absolute bottom-6 left-0 right-0 flex justify-between items-center z-50 px-8">
                <button onClick={prevSlide} disabled={currentSlide === 0} className="disabled:opacity-20 hover:text-white transition group items-center gap-1 flex text-sm opacity-50">
                    <ChevronLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" /> Retour
                </button>
                <span className="text-xs text-zinc-500">{currentSlide + 1} / {slides.length}</span>
                <button onClick={nextSlide} disabled={currentSlide === slides.length - 1} className="disabled:opacity-20 hover:text-white transition group items-center gap-1 flex text-sm opacity-50">
                    Suivant <ChevronRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                </button>
            </div>
        </div>
    );
}
