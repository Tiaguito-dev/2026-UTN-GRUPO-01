import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { BackLink } from "./BackLink";

export interface BreadcrumbItem {
  label: string;
  href?: string;
}

type BackDestination = { href: string; label: string };

function isInternalHref(href: string | undefined): href is string {
  return Boolean(href?.startsWith("/") && !href.startsWith("//") && !/[\\\s\u0000-\u001f\u007f]/u.test(href));
}

/** A known internal destination keeps return navigation independent of browser history. */
export function Breadcrumb({ items, back }: { items: BreadcrumbItem[]; back?: BackDestination }) {
  if (!items.length) return null;
  const parent = items.slice(0, -1).findLast((item) => isInternalHref(item.href));
  const destination = back && isInternalHref(back.href) ? back
    : parent?.href ? { href: parent.href, label: parent.label } : { href: "/home", label: "Inicio" };
  return (
    <div className="page-nav">
      <BackLink {...destination} />
      <nav aria-label="Ubicación actual" className="breadcrumb">
        <ol>
          {items.map((item, index) => {
            const isLast = index === items.length - 1;
            return (
              <li key={index}>
                {index > 0 ? (
                  <ChevronRight className="breadcrumb-separator" aria-hidden="true" focusable="false" size={16} strokeWidth={1.75} />
                ) : null}
                {isLast || !isInternalHref(item.href) ? (
                  <span aria-current={isLast ? "page" : undefined}>{item.label}</span>
                ) : (
                  <Link href={item.href}>{item.label}</Link>
                )}
              </li>
            );
          })}
        </ol>
      </nav>
    </div>
  );
}
