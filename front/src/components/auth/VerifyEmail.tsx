"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { verifyEmail } from "@/services/email-verification";

type Result = { status: "pending" | "success" | "error"; message: string };

export function VerifyEmail() {
  const initialized = useRef(false);
  const resultRef = useRef<HTMLDivElement>(null);
  const [result, setResult] = useState<Result>({ status: "pending", message: "Verificando tu correo institucional…" });

  useEffect(() => {
    if (initialized.current) return;
    initialized.current = true;
    const url = new URL(window.location.href);
    const tokens = url.searchParams.getAll("token");
    const token = tokens.length === 1 && /^[A-Za-z0-9_-]{43}$/.test(tokens[0] ?? "") ? tokens[0] : null;
    // Keep the credential in this request's closure only; never in browser storage or URL.
    window.history.replaceState(window.history.state, "", url.pathname);
    if (!token) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- the token is read from window.location once after mount; reading it during render would break SSR hydration.
      setResult({ status: "error", message: "El enlace de verificación no es válido. Solicitá uno nuevo." });
      return;
    }
    void verifyEmail(token).then(
      () => setResult({ status: "success", message: "Correo verificado. Tu cuenta está habilitada para iniciar sesión." }),
      (failure: unknown) => setResult({ status: "error", message: failure instanceof Error ? failure.message : "No pudimos verificar tu correo. Solicitá un nuevo enlace." }),
    );
  }, []);

  useEffect(() => {
    if (result.status !== "pending") resultRef.current?.focus();
  }, [result.status]);

  return <section aria-labelledby="heading-verify-email" aria-busy={result.status === "pending"}>
    <h1 id="heading-verify-email">Verificar correo institucional</h1>
    <div ref={resultRef} tabIndex={-1} role={result.status === "error" ? "alert" : "status"} className={`notice ${result.status === "error" ? "error" : result.status === "success" ? "success" : ""}`}>{result.message}</div>
    <div className="form-links"><Link href="/login">Ir a iniciar sesión</Link>{result.status === "error" ? <Link href="/resend-verification">Solicitar un nuevo enlace de verificación</Link> : null}</div>
  </section>;
}
