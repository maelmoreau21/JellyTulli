"use client";

import { useState } from 'react';
import { Film } from 'lucide-react';

interface FallbackImageProps {
    src: string;
    alt: string;
    className?: string;
}

export function FallbackImage({ src, alt, className }: FallbackImageProps) {
    const [error, setError] = useState(!src || src.includes('undefined'));

    if (error) {
        return (
            <div className={`flex items-center justify-center bg-zinc-800/80 w-full h-full ${className}`}>
                <Film className="w-1/2 h-1/2 text-zinc-600" />
            </div>
        );
    }

    return (
        <img
            src={src}
            alt={alt}
            className={`object-cover w-full h-full ${className || ''}`}
            onError={() => setError(true)}
        />
    );
}
