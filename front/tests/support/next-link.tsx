import type { AnchorHTMLAttributes } from "react";

/** Plain anchor in place of next/link: the specs exercise the components, not App Router navigation. */
export default function Link({ href, children, ...rest }: AnchorHTMLAttributes<HTMLAnchorElement> & { href: string }) {
  return <a href={href} {...rest}>{children}</a>;
}
