"use client";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { parseMateriaPage } from "@/validations/materias";

/**
 * The current page lives only in the URL (?page=N) and is read on every render. `setPage` replaces
 * the URL keeping the other query params; `setPage(1)` removes `page`.
 */
export function useUrlPagination() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const page = parseMateriaPage(searchParams.get("page"));

  const setPage = (next: number) => {
    const query = new URLSearchParams(searchParams.toString());
    if (next <= 1) query.delete("page"); else query.set("page", String(next));
    const search = query.toString();
    router.replace(search ? `${pathname}?${search}` : pathname, { scroll: false });
  };

  return { page, setPage };
}
