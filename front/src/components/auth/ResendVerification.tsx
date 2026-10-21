"use client";

import Link from "next/link";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { resendVerification } from "@/services/email-verification";
import { validateEmail } from "@/validations/auth";

export function ResendVerification() {
  const submitting = useRef(false);
  const emailRef = useRef<HTMLInputElement>(null);
  const errorRef = useRef<HTMLDivElement>(null);
  const [busy, setBusy] = useState(false);
  const [emailError, setEmailError] = useState<string>();
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  useEffect(() => { if (error) errorRef.current?.focus(); }, [error]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting.current) return;
    const form = event.currentTarget;
    const email = String(new FormData(form).get("email") ?? "");
    const issue = validateEmail(email);
    setEmailError(issue);
    setError("");
    setSuccess("");
    if (issue) { emailRef.current?.focus(); return; }
    submitting.current = true;
    setBusy(true);
    try {
      setSuccess(await resendVerification(email));
      form.reset();
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "No pudimos completar la solicitud. Intentá nuevamente.");
    } finally {
      submitting.current = false;
      setBusy(false);
    }
  }

  return <section aria-labelledby="heading-resend-verification">
    <h1 id="heading-resend-verification">Solicitar verificación de correo</h1>
    <p className="intro">Ingresá el correo @alu.frlp.utn.edu.ar con el que te registraste. También podés solicitar el enlace si creaste tu cuenta antes de que se habilitara la verificación.</p>
    <p>Revisá tu bandeja de entrada y spam. El nuevo enlace reemplaza los anteriores.</p>
    {error ? <div ref={errorRef} role="alert" tabIndex={-1} className="notice error">{error}</div> : null}
    {success ? <div role="status" className="notice success">{success}</div> : null}
    <form onSubmit={submit} noValidate aria-busy={busy}>
      <div className="field"><label htmlFor="verification-email">Email institucional</label><input ref={emailRef} id="verification-email" name="email" type="email" autoComplete="email" required aria-invalid={Boolean(emailError)} aria-describedby={emailError ? "verification-email-error" : undefined} />{emailError ? <p id="verification-email-error" className="field-error">Error: {emailError}</p> : null}</div>
      <button className="submit" disabled={busy}>{busy ? "Enviando…" : "Enviar enlace de verificación"}</button>
    </form>
    <div className="form-links"><Link href="/login">Volver al login</Link><Link href="/register">Crear una cuenta</Link></div>
  </section>;
}
