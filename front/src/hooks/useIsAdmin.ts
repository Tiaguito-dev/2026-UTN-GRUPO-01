"use client";
import { useAuth } from "./useAuth";

/** True only for an authenticated ADMIN account; false while the session is still loading. */
export function useIsAdmin() {
  return useAuth().account?.role === "ADMIN";
}
