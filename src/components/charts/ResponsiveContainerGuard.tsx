"use client";

import React, { useRef, useEffect, useState } from "react";
import { ResponsiveContainer as RechartsResponsiveContainer } from "recharts";

type Props = React.ComponentProps<typeof RechartsResponsiveContainer>;

export default function ResponsiveContainerGuard(props: Props) {
    const containerRef = useRef<HTMLDivElement | null>(null);
    const [hasSize, setHasSize] = useState(false);

    useEffect(() => {
        const el = containerRef.current;
        if (!el) return;

        const update = () => {
            const rect = el.getBoundingClientRect();
            setHasSize(rect.width > 0 && rect.height > 0);
        };

        if (typeof ResizeObserver === "undefined") {
            update();
            return;
        }

        update();
        const ro = new ResizeObserver(() => update());
        ro.observe(el);
        return () => ro.disconnect();
    }, []);

    const minH = (() => {
        const anyProps = props as any;
        if (typeof anyProps.minHeight === "number") return anyProps.minHeight;
        if (typeof anyProps.height === "number") return anyProps.height;
        return 300;
    })();

    const placeholderStyle: React.CSSProperties = {
        width: "100%",
        height: minH,
    };

    return (
        <div ref={containerRef} style={{ width: "100%" }}>
            {hasSize ? (
                <RechartsResponsiveContainer {...props} />
            ) : (
                <div style={placeholderStyle} />
            )}
        </div>
    );
}
