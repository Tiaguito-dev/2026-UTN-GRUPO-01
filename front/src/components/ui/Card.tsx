import type { ElementType, HTMLAttributes, ReactNode } from "react";

/** Each variant keeps the padding, width and shadow of the class it replaced (TASK-029, decision 1). */
export type CardVariant = "panel" | "empty" | "profile" | "auth";

export function Card({ variant, as: Tag = "div", children, ...rest }: { variant: CardVariant; as?: ElementType; children: ReactNode } & HTMLAttributes<HTMLElement>) {
  return <Tag {...rest} className={`card card-${variant}`}>{children}</Tag>;
}
