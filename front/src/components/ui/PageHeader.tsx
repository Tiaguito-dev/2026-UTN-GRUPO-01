"use client";

import type { ReactNode } from "react";
import { useFocusOnMount } from "@/hooks/useFocusOnMount";
import { Breadcrumb, type BreadcrumbItem } from "./Breadcrumb";

/**
 * Screen title. The `<h1>` takes focus when it mounts and whenever `focusKey` changes, so a
 * screen reader announces the new screen. The screen creates `id` with `useId` and passes it
 * here and to its `<section aria-labelledby>`. Renders a fragment so the layout CSS still applies.
 */
export function PageHeader({ id, title, description, eyebrow, breadcrumb, focusKey }: {
  id: string;
  title: ReactNode;
  description?: ReactNode;
  eyebrow?: ReactNode;
  breadcrumb?: BreadcrumbItem[];
  focusKey?: unknown;
}) {
  const headingFocus = useFocusOnMount<HTMLHeadingElement>(focusKey);
  return <>
    {breadcrumb ? <Breadcrumb items={breadcrumb} /> : null}
    {eyebrow ? <p className="eyebrow">{eyebrow}</p> : null}
    <h1 ref={headingFocus} tabIndex={-1} id={id}>{title}</h1>
    {description ? <p className="system-description">{description}</p> : null}
  </>;
}
