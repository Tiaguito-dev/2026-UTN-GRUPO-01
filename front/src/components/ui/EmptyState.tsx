import type { ReactNode } from "react";
import { Badge } from "./Badge";
import { Card } from "./Card";

/**
 * Without `symbol` or `title` it is the compact empty state of a list: one paragraph inside a
 * panel, with the action inline. With them it is the full block of Inicio and Próximamente, where
 * `children` are the paragraphs and the action goes below.
 */
export function EmptyState({ children, action, symbol, title, badge }: { children: ReactNode; action?: ReactNode; symbol?: string; title?: string; badge?: string }) {
  if (!symbol && !title) return <Card variant="panel"><p>{children}{action ? <>{" "}{action}</> : null}</p></Card>;
  return <Card variant="empty">
    {symbol ? <span className="empty-symbol" aria-hidden="true">{symbol}</span> : null}
    {badge ? <Badge tone="upcoming">{badge}</Badge> : null}
    {title ? <h2>{title}</h2> : null}
    {children}
    {action}
  </Card>;
}
