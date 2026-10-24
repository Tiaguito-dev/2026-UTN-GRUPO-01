import Link from "next/link";

export interface BreadcrumbItem { label: string; href?: string }

export function Breadcrumb({ items }: { items: BreadcrumbItem[] }) {
  return <nav aria-label="Ubicación actual" className="breadcrumb">
    <ol>
      {items.map((item, index) => <li key={index}>
        {item.href ? <Link href={item.href}>{item.label}</Link> : <span aria-current="page">{item.label}</span>}
      </li>)}
    </ol>
  </nav>;
}
