"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { useAuth } from "@/hooks/useAuth";
import { COORDINATION_NOTICE } from "@/services/session-coordinator";
import { validateEmail, validateNewPassword, validateDisplayName, validateCurrentPassword, safeReturnPath } from "@/validations/auth";

type Mode = "login" | "register" | "forgot" | "reset" | "change";
const titles: Record<Mode, string> = { login: "Iniciar sesión", register: "Crear cuenta", forgot: "Recuperar contraseña", reset: "Restablecer contraseña", change: "Cambiar contraseña" };
const actions: Record<Mode, string> = { login: "Iniciar sesión", register: "Crear cuenta", forgot: "Enviar instrucciones", reset: "Restablecer contraseña", change: "Cambiar contraseña" };
const messages: Record<string, string> = { registered: "Cuenta creada. Iniciá sesión para continuar.", reset: "Contraseña restablecida. Iniciá sesión con tu nueva contraseña.", changed: "Contraseña cambiada. Iniciá sesión nuevamente.", logout: "Sesión cerrada correctamente." };
const passwordHint = "Usá entre 8 y 128 caracteres. Podés incluir espacios y caracteres Unicode. La contraseña no se recorta.";

function Field({ name, label, type = "text", autoComplete, error, hint }: { name: string; label: string; type?: string; autoComplete?: string; error?: string; hint?: string }) {
  return <div className="field"><label htmlFor={name}>{label}</label><input id={name} name={name} type={type} autoComplete={autoComplete} required aria-invalid={Boolean(error)} aria-describedby={[hint ? `${name}-hint` : "", error ? `${name}-error` : ""].filter(Boolean).join(" ") || undefined} />{hint ? <p id={`${name}-hint`} className="hint">{hint}</p> : null}{error ? <p id={`${name}-error`} className="field-error">Error: {error}</p> : null}</div>;
}

export function AccountForm({ mode }: { mode: Mode }) {
  const auth = useAuth();
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const errorRef = useRef<HTMLDivElement>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const initialized = useRef(false);
  const submitting = useRef(false);
  const resetToken = useRef<string | null>(null);
  const [tokenReady, setTokenReady] = useState(mode !== "reset");
  const [busy, setBusy] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  useEffect(() => {
    if (initialized.current) return;
    initialized.current = true;
    headingRef.current?.focus();
    if (mode === "reset") {
      const url = new URL(window.location.href);
      const tokens = url.searchParams.getAll("token");
      resetToken.current = tokens.length === 1 && /^[A-Za-z0-9_-]{43}$/.test(tokens[0] ?? "") ? tokens[0]! : null;
      // Preserve the credential only in memory. Also remove fragments and unrelated query data.
      window.history.replaceState(window.history.state, "", url.pathname);
      setTokenReady(true);
      if (!resetToken.current) setError("El enlace de recuperación no es válido. Solicitá uno nuevo.");
    }
    if (mode === "login") {
      const notice = new URL(window.location.href).searchParams.get("notice");
      setSuccess(notice ? messages[notice] ?? "" : "");
    }
  }, [mode]);

  useEffect(() => {
    if (!error) return;
    errorRef.current?.focus();
  }, [error]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting.current) return;
    const form = event.currentTarget;
    const data = new FormData(form);
    const value = (key: string) => String(data.get(key) ?? "");
    const nextErrors: Record<string, string> = {};
    const check = (key: string, issue: string | undefined) => { if (issue) nextErrors[key] = issue; };
    if (["login", "register", "forgot"].includes(mode)) check("email", validateEmail(value("email")));
    if (mode === "register") check("displayName", validateDisplayName(value("displayName")));
    if (mode === "login") check("password", validateCurrentPassword(value("password")));
    if (mode === "register") check("password", validateNewPassword(value("password")));
    if (["reset", "change"].includes(mode)) {
      check("newPassword", validateNewPassword(value("newPassword")));
      if (value("confirmPassword") !== value("newPassword")) nextErrors.confirmPassword = "Las contraseñas no coinciden.";
    }
    if (mode === "change") {
      check("currentPassword", validateCurrentPassword(value("currentPassword")));
      if (value("newPassword") === value("currentPassword")) nextErrors.newPassword = "La nueva contraseña debe ser diferente de la actual.";
    }
    setErrors(nextErrors);
    setError("");
    setSuccess("");
    if (Object.keys(nextErrors).length) {
      form.querySelector<HTMLInputElement>(`[name="${Object.keys(nextErrors)[0]}"]`)?.focus();
      return;
    }
    if (mode === "reset" && !resetToken.current) {
      setError("El enlace de recuperación no es válido. Solicitá uno nuevo.");
      return;
    }
    submitting.current = true;
    setBusy(true);
    try {
      if (mode === "register") {
        await auth.register({ email: value("email"), displayName: value("displayName"), password: value("password") });
        form.reset();
        router.replace("/login?notice=registered");
      } else if (mode === "login") {
        const destination = safeReturnPath(new URL(window.location.href).searchParams.get("returnTo"));
        await auth.login({ email: value("email"), password: value("password") });
        form.reset();
        router.replace(destination);
      } else if (mode === "forgot") {
        const message = await auth.forgotPassword({ email: value("email") });
        form.reset();
        setSuccess(message);
      } else if (mode === "reset") {
        await auth.resetPassword({ token: resetToken.current!, newPassword: value("newPassword") });
        resetToken.current = null;
        form.reset();
        router.replace("/login?notice=reset");
      } else {
        await auth.changePassword({ currentPassword: value("currentPassword"), newPassword: value("newPassword") });
        form.reset();
        router.replace("/login?notice=changed");
      }
    } catch (failure) {
      if (mode === "reset" && typeof failure === "object" && failure !== null && "status" in failure && failure.status === 400) resetToken.current = null;
      setError(failure instanceof Error ? failure.message : "No pudimos completar la solicitud. Intentá nuevamente.");
    } finally {
      submitting.current = false;
      setBusy(false);
    }
  }

  const hasEmail = ["register", "login", "forgot"].includes(mode);
  return <section aria-labelledby={`heading-${mode}`}><h1 ref={headingRef} tabIndex={-1} id={`heading-${mode}`}>{titles[mode]}</h1>
    {mode === "login" ? <p className="intro">Tu próximo paso empieza acá. Ingresá a tu cuenta.</p> : null}
    {mode === "register" ? <p className="intro">Sumate a una comunidad que comparte su experiencia universitaria.</p> : null}
    {mode === "forgot" ? <p className="intro">Ingresá tu email y te enviaremos instrucciones para recuperar el acceso.</p> : null}
    {mode === "reset" ? <p className="intro">Al restablecer tu contraseña se cerrarán todas tus sesiones. Si recargás esta página, volvé a abrir el enlace del email.</p> : null}
    {mode === "change" ? <p className="intro">El cambio cerrará todas tus sesiones, incluida esta.</p> : null}
    {mode === "login" && !auth.coordinationAvailable ? <p role="status" className="notice warning">{COORDINATION_NOTICE}</p> : null}
    {error ? <div ref={errorRef} role="alert" tabIndex={-1} className="notice error">{error}</div> : null}
    {success ? <div role="status" className="notice success">{success}</div> : null}
    <form ref={formRef} onSubmit={submit} noValidate aria-busy={busy}>
      {mode === "register" ? <Field name="displayName" label="Nombre visible" autoComplete="nickname" error={errors.displayName} /> : null}
      {hasEmail ? <Field name="email" label="Email" type="email" autoComplete={mode === "login" ? "username" : "email"} error={errors.email} /> : null}
      {["login", "register"].includes(mode) ? <Field name="password" label="Contraseña" type="password" autoComplete={mode === "login" ? "current-password" : "new-password"} error={errors.password} hint={mode === "register" ? passwordHint : undefined} /> : null}
      {mode === "change" ? <Field name="currentPassword" label="Contraseña actual" type="password" autoComplete="current-password" error={errors.currentPassword} /> : null}
      {["reset", "change"].includes(mode) ? <><Field name="newPassword" label="Nueva contraseña" type="password" autoComplete="new-password" error={errors.newPassword} hint={passwordHint} /><Field name="confirmPassword" label="Confirmar contraseña" type="password" autoComplete="new-password" error={errors.confirmPassword} /></> : null}
      <button className="submit" disabled={busy || !tokenReady || (mode === "reset" && !resetToken.current)}>{busy ? "Enviando…" : actions[mode]}</button>
    </form>
    {mode === "change" ? <div className="form-links"><Link href="/account">Volver a mi perfil</Link></div> : null}
    <div className="form-links">{mode === "login" ? <><Link href="/register">Crear una cuenta</Link><Link href="/forgot-password">¿Olvidaste tu contraseña?</Link></> : null}{["forgot", "register", "reset"].includes(mode) ? <Link href="/login">Volver al login</Link> : null}{mode === "reset" ? <Link href="/forgot-password">Solicitar un nuevo enlace de recuperación</Link> : null}</div>
  </section>;
}
