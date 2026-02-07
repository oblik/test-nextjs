"use client";

import filler from "./filler.json";

export function PageChild({ children }: { children: React.ReactNode }) {
  console.log("rendering PageChild", Object.keys(filler).slice(0, 3));
  return children;
}
