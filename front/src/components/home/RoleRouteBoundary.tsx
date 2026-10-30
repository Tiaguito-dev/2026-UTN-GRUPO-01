"use client";

import { useEffect, type ReactNode } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";
import { roleDestination } from "@/lib/navigation";

/** Resolve the confirmed role before mounting content that belongs to another journey. */
export function RoleRouteBoundary({ children }: { children: ReactNode }) {
  const { account, status } = useAuth();
  const pathname = usePathname();
  const params = useSearchParams();
  const router = useRouter();
  const current = `${pathname}${params.size ? `?${params}` : ""}`;
  const destination = roleDestination(account?.role, current);
  const redirecting = status === "authenticated" && account?.role === "ADMIN" && destination !== current;
  useEffect(() => {
    if (redirecting) router.replace(destination);
  }, [redirecting, destination, router]);
  return redirecting ? <p role="status">Abriendo administración…</p> : children;
}
