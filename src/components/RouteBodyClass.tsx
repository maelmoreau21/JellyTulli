"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

export function RouteBodyClass() {
  const pathname = usePathname();

  useEffect(() => {
    const wrappedRoute = pathname?.startsWith("/wrapped") ?? false;
    document.body.classList.toggle("route-wrapped", wrappedRoute);

    return () => {
      document.body.classList.remove("route-wrapped");
    };
  }, [pathname]);

  return null;
}
