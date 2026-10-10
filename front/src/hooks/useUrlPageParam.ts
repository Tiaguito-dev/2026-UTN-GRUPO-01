"use client";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

/** Keeps the current pagination page reflected in the URL (?page=N), preserving other query params. */
export function useUrlPageParam(): [number, (page: number) => void] {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const initialPage = Math.max(1, Number(searchParams.get("page")) || 1);

  const setUrlPage = (page: number) => {
    const next = new URLSearchParams(searchParams.toString());
    if (page <= 1) next.delete("page"); else next.set("page", String(page));
    const query = next.toString();
    router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
  };

  return [initialPage, setUrlPage];
}
