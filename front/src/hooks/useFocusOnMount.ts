import { useEffect, useRef } from "react";

/** Moves focus to the returned element when it mounts and whenever `key` changes. */
export function useFocusOnMount<T extends HTMLElement>(key?: unknown) {
  const ref = useRef<T>(null);
  useEffect(() => { ref.current?.focus(); }, [key]);
  return ref;
}
