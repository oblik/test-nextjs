"use client";

import { useEffect, useRef } from "react";

export default function AdminPage() {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let dispose: (() => void) | undefined;

    import("@/solid-admin/App").then((mod) => {
      if (containerRef.current) {
        dispose = mod.mount(containerRef.current);
      }
    });

    return () => dispose?.();
  }, []);

  return <div ref={containerRef} />;
}
