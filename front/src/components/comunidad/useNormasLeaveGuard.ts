"use client";

import { useEffect, useId, useRef, useState } from "react";
import { useRouter } from "next/navigation";

type LeaveAction = { kind: "link"; href: string } | { kind: "back" };
const MARKER = "__communityNormasGuard";

/** Protección exclusiva del editor; no intercepta navegación programática de sesión/seguridad. */
export function useNormasLeaveGuard(dirty: boolean, busy: boolean) {
  const router = useRouter();
  const token = useId();
  const routerRef = useRef(router);
  const dirtyRef = useRef(dirty);
  const busyRef = useRef(busy);
  const mounted = useRef(false);
  const armed = useRef(false);
  const restoringBack = useRef(false);
  const bypass = useRef(false);
  const finishNavigation = useRef<(() => void) | null>(null);
  const [pendingLeave, setPendingLeave] = useState<LeaveAction | null>(null);

  useEffect(() => { routerRef.current = router; dirtyRef.current = dirty; busyRef.current = busy; }, [router, dirty, busy]);

  useEffect(() => {
    mounted.current = true;
    function beforeUnload(event: BeforeUnloadEvent) {
      if (!dirtyRef.current || bypass.current) return;
      event.preventDefault(); event.returnValue = "";
    }
    function click(event: MouseEvent) {
      if (bypass.current || event.defaultPrevented || event.button !== 0) return;
      const target = event.target instanceof Element ? event.target : null;
      const logout = target?.closest<HTMLButtonElement>(".logout-control button");
      if (logout && (dirtyRef.current || busyRef.current)) {
        // Sin mover foco ni recrear el botón: el menú y su manejo de errores siguen intactos.
        if (busyRef.current || !window.confirm("Tenés cambios sin guardar. Si cerrás sesión, se perderán. ¿Querés cerrar sesión?")) {
          event.preventDefault(); event.stopPropagation();
        }
        return;
      }
      if (event.metaKey || event.ctrlKey || event.altKey || event.shiftKey) return;
      const anchor = target?.closest<HTMLAnchorElement>("a[href]");
      if (!anchor || anchor.hasAttribute("download") || (anchor.target && anchor.target !== "_self")) return;
      const destination = new URL(anchor.href, window.location.href);
      if (!["http:", "https:"].includes(destination.protocol)) return;
      if (destination.origin === window.location.origin && destination.pathname === window.location.pathname && destination.search === window.location.search) return;
      if (!dirtyRef.current && !busyRef.current) return;
      event.preventDefault(); event.stopPropagation();
      if (!busyRef.current) setPendingLeave({ kind: "link", href: destination.href });
    }
    function popState() {
      if (bypass.current || !armed.current) return;
      if (!dirtyRef.current && !busyRef.current) {
        if (window.history.state?.[MARKER] !== token) {
          bypass.current = true;
          armed.current = false;
          window.history.back();
        }
        return;
      }
      if (window.history.state?.[MARKER] === token) {
        if (restoringBack.current) {
          restoringBack.current = false;
          if (!busyRef.current) setPendingLeave({ kind: "back" });
        }
        return;
      }
      // El primer Atrás llega a la copia original del mismo URL. Restaurar antes de decidir.
      restoringBack.current = true;
      window.history.forward();
    }
    window.addEventListener("beforeunload", beforeUnload);
    document.addEventListener("click", click, true);
    window.addEventListener("popstate", popState);
    return () => {
      mounted.current = false;
      armed.current = false;
      window.removeEventListener("beforeunload", beforeUnload);
      document.removeEventListener("click", click, true);
      window.removeEventListener("popstate", popState);
      finishNavigation.current?.(); finishNavigation.current = null;
    };
  }, [token]);

  useEffect(() => {
    if (!dirty || armed.current || bypass.current) return;
    window.history.pushState({ ...window.history.state, [MARKER]: token }, "", window.location.href);
    armed.current = true;
  }, [dirty, token]);

  function leaveAfterSave(href: string) {
    bypass.current = true;
    setPendingLeave(null);
    function navigate() {
      if (!mounted.current) return;
      const destination = new URL(href, window.location.href);
      if (destination.origin === window.location.origin) routerRef.current.replace(`${destination.pathname}${destination.search}${destination.hash}`);
      else window.location.assign(destination.href);
    }
    if (window.history.state?.[MARKER] === token) {
      armed.current = false;
      const complete = () => {
        finishNavigation.current = null;
        navigate();
      };
      window.addEventListener("popstate", complete, { once: true });
      finishNavigation.current = () => window.removeEventListener("popstate", complete);
      window.history.back();
    } else navigate();
  }

  function requestLeave(href: string) {
    if (busyRef.current) return;
    if (dirtyRef.current) setPendingLeave({ kind: "link", href });
    else leaveAfterSave(href);
  }

  function confirmLeave() {
    if (!pendingLeave || busyRef.current) return;
    if (pendingLeave.kind === "link") leaveAfterSave(pendingLeave.href);
    else {
      bypass.current = true;
      armed.current = false;
      setPendingLeave(null);
      window.history.go(window.history.state?.[MARKER] === token ? -2 : -1);
    }
  }

  return { pendingLeave, requestLeave, leaveAfterSave, confirmLeave, cancelLeave: () => setPendingLeave(null) };
}
