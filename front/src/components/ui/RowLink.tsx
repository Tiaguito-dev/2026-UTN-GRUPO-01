import Link from "next/link";
import type { ReactNode } from "react";

export interface RowLinkProps {
  href: string;
  children: ReactNode;
  detail?: ReactNode;
  trailing?: ReactNode;
  className?: string;
  current?: boolean;
}

export function RowLink({
  href,
  children,
  detail,
  trailing,
  className,
  current = false,
}: RowLinkProps) {
  const content = (
    <>
      <span className="row-link-content">
        <span className="row-link-title">{children}</span>
        {detail ? (
          <>
            {" "}
            <span className="row-link-detail">{detail}</span>
          </>
        ) : null}
      </span>
      <span className="row-link-end" aria-hidden="true">
        {trailing ? <span className="row-link-trailing">{trailing}</span> : null}
        {!current ? (
          <svg
            className="row-chevron"
            aria-hidden="true"
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
          >
            <path d="M9 6l6 6-6 6" />
          </svg>
        ) : null}
      </span>
    </>
  );

  const classes = current
    ? `row-link row-link-current${className ? ` ${className}` : ""}`
    : `row-link${className ? ` ${className}` : ""}`;

  return (
    <li>
      {current ? (
        <span className={classes} aria-current="page">
          {content}
        </span>
      ) : (
        <Link href={href} className={classes}>
          {content}
        </Link>
      )}
    </li>
  );
}
