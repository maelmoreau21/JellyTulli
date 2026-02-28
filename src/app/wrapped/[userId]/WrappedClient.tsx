"use client";

import { useState, useEffect } from "react";
import { ChevronRight, ChevronLeft, Share2, Play, Star, Calendar, Clock, X } from "lucide-react";
import { useRouter } from "next/navigation";

interface WrappedData {
    username: string;
    year: number;
    totalHours: number;
    topMedia: string[];
    topGenre: string;
    topDay: string;
    totalSessions: number;
}

export default function WrappedClient({ data }: { data: WrappedData }) {
    const [currentSlide, setCurrentSlide] = useState(0);
    const router = useRouter();

    const slides = [
        {
            title: `JellyTulli Wrapped ${data.year}`,
            subtitle: `C'est l'heure du bilan, ${data.username}.`,
            icon: <Play className="w-16 h-16 mb-6 text-white animate-pulse" />,
            bgColor: "bg-gradient-to-br from-indigo-900 via-purple-900 to-black",
            content: <p className="text-xl text-center text-zinc-300 max-w-sm">Prêt à découvrir tes statistiques de cette année ?</p>
        },
        {
            title: "Un temps infiniment bien dépensé.",
            subtitle: "Temps total de visionnage",
            icon: <Clock className="w-16 h-16 mb-4 text-emerald-400" />,
            bgColor: "bg-gradient-to-br from-emerald-900 via-teal-900 to-black",
            content: (
                <div className="flex flex-col items-center">
                    <span className="text-6xl font-black text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 to-cyan-400 mb-2">
                        {data.totalHours}
                    </span>
                    <span className="text-2xl font-semibold text-zinc-200">Heures</span>
                    <p className="mt-4 text-zinc-400">réparties sur {data.totalSessions} sessions au total.</p>
                </div>
            )
        },
        {
            title: "Ton humeur de l'année.",
            subtitle: "Genre favori",
            icon: <Star className="w-16 h-16 mb-4 text-pink-400" />,
            bgColor: "bg-gradient-to-br from-pink-900 via-rose-900 to-black",
            content: (
                <div className="flex flex-col items-center">
                    <span className="text-5xl font-black text-transparent bg-clip-text bg-gradient-to-r from-pink-400 to-orange-400 mb-2 text-center uppercase tracking-wider">
                        {data.topGenre}
                    </span>
                    <p className="mt-4 text-zinc-400 text-center max-w-sm">C'est ce qui ta fait vibrer cette année.</p>
                </div>
            )
        },
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
        {
            title: "Le Panthéon.",
            subtitle: "Tes 3 œuvres préférées",
            icon: <Star className="w-12 h-12 mb-4 text-yellow-500" />,
            bgColor: "bg-gradient-to-br from-blue-900 via-indigo-900 to-black",
            content: (
                <div className="flex flex-col w-full max-w-md gap-4 px-6">
                    {data.topMedia.length > 0 ? data.topMedia.map((m, i) => (
                        <div key={i} className="flex items-center p-4 bg-white/10 rounded-xl backdrop-blur-md">
                            <span className="text-2xl font-bold text-white/50 w-8">{i + 1}</span>
                            <span className="text-lg font-bold text-white truncate flex-1">{m}</span>
                        </div>
                    )) : <p className="text-center text-zinc-400">Aucune donnée suffisante.</p>}
                </div>
            )
        },
        {
            title: "C'est dans la boîte.",
            subtitle: "Raconte-le au monde.",
            icon: <Share2 className="w-16 h-16 mb-4 text-fuchsia-400" />,
            bgColor: "bg-gradient-to-br from-purple-900 via-fuchsia-900 to-black",
            content: (
                <div className="flex flex-col items-center gap-6">
                    <div className="p-6 bg-black/40 rounded-2xl border border-white/10 backdrop-blur-xl flex flex-col items-center text-center">
                        <p className="text-sm text-zinc-400 mb-1">JellyTulli Wrapped {data.year}</p>
                        <h3 className="text-2xl font-bold text-white mb-4">{data.username}</h3>
                        <p className="text-fuchsia-400 font-bold">{data.totalHours}h de stream</p>
                        <p className="text-zinc-300 text-sm mt-1">Top Genre: {data.topGenre}</p>
                    </div>
                    <p className="text-xs text-zinc-500">Capture cet écran pour partager.</p>
                </div>
            )
        }
    ];

    const nextSlide = () => {
        if (currentSlide < slides.length - 1) {
            setCurrentSlide(c => c + 1);
        }
    };

    const prevSlide = () => {
        if (currentSlide > 0) {
            setCurrentSlide(c => c - 1);
        }
    };

    // Auto-advance logic (like stories)
    useEffect(() => {
        const timer = setTimeout(() => {
            if (currentSlide < slides.length - 1) {
                setCurrentSlide(c => c + 1);
            }
        }, 6000); // 6 seconds per slide
        return () => clearTimeout(timer);
    }, [currentSlide, slides.length]);

    const current = slides[currentSlide];

    return (
        <div className={`fixed inset-0 z-50 flex flex-col text-white transition-colors duration-700 ease-in-out ${current.bgColor}`}>
            {/* Progress Bars */}
            <div className="absolute top-0 left-0 right-0 p-4 flex gap-2 z-50">
                {slides.map((_, i) => (
                    <div key={i} className="flex-1 h-1.5 bg-white/20 rounded-full overflow-hidden">
                        <div
                            className={`h-full bg-white transition-all duration-100 ease-linear ${i === currentSlide ? 'w-full animate-[progress_6s_linear]' : i < currentSlide ? 'w-full' : 'w-0'}`}
                        />
                    </div>
                ))}
            </div>

            {/* Controls */}
            <button onClick={() => router.back()} className="absolute top-8 right-4 p-2 z-50 rounded-full bg-white/10 hover:bg-white/20 transition backdrop-blur">
                <X className="w-5 h-5 text-white" />
            </button>

            {/* Tap areas for navigation */}
            <div className="absolute inset-0 z-40 flex">
                <div className="w-1/3 h-full cursor-pointer" onClick={prevSlide} />
                <div className="w-2/3 h-full cursor-pointer" onClick={nextSlide} />
            </div>

            {/* Content Viewer */}
            <div className="flex-1 flex flex-col items-center justify-center p-6 text-center z-30 pointer-events-none">
                <style jsx>{`
                    @keyframes progress {
                        from { width: 0%; }
                        to { width: 100%; }
                    }
                `}</style>
                <div className="animate-in fade-in slide-in-from-bottom-8 duration-700 ease-out flex flex-col items-center" key={currentSlide}>
                    {current.icon}
                    <h2 className="text-xl font-bold tracking-widest text-zinc-400 uppercase mb-2">{current.subtitle}</h2>
                    <h1 className="text-4xl md:text-5xl font-black tracking-tight mb-8 leading-tight max-w-2xl">{current.title}</h1>
                    {current.content}
                </div>
            </div>

            {/* Bottom Controls Indicator */}
            <div className="absolute bottom-8 left-0 right-0 flex justify-center gap-8 z-50 px-8 opacity-50">
                <button onClick={prevSlide} disabled={currentSlide === 0} className="disabled:opacity-20 hover:text-white transition group items-center gap-1 flex text-sm">
                    <ChevronLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" /> Retour
                </button>
                <button onClick={nextSlide} disabled={currentSlide === slides.length - 1} className="disabled:opacity-20 hover:text-white transition group items-center gap-1 flex text-sm">
                    Suivant <ChevronRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                </button>
            </div>
        </div>
    );
}
