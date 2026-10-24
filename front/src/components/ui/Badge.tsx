import type { ReactNode } from "react";

export function Badge({ tone, children }: { tone: "role" | "upcoming"; children: ReactNode }) {
  return <span className={`badge badge-${tone}`}>{children}</span>;
}
