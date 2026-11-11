"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useId, useRef, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useFormSubmission } from "@/hooks/useFormSubmission";
import { COORDINATION_NOTICE } from "@/services/session-coordinator";
import { validateEmail, validateNewPassword, validateDisplayName, validateCurrentPassword } from "@/validations/auth";
import { roleDestination } from "@/lib/navigation";
import { FormField } from "@/components/ui/FormField";
import { Notice } from "@/components/ui/Notice";
import { PageHeader } from "@/components/ui/PageHeader";

type Mode = "login" | "register" | "forgot" | "reset" | "change";
type Field = "email" | "displayName" | "password" | "currentPassword" | "newPassword" | "confirmPassword";
const fields: Field[] = ["email", "displayName", "password", "currentPassword", "newPassword", "confirmPassword"];
const titles: Record<Mode, string> = { login: "Iniciar sesión", register: "Crear cuenta", forgot: "Recuperar contraseña", reset: "Restablecer contraseña", change: "Cambiar contraseña" };
const actions: Record<Mode, string> = { login: "Iniciar sesión", register: "Crear cuenta", forgot: "Enviar instrucciones", reset: "Restablecer contraseña", change: "Cambiar contraseña" };
const messages: Record<string, string> = { registered: "Cuenta creada, pendiente de verificación. Enviamos un enlace a tu correo institucional. Revisá tu bandeja de entrada y spam y verificá tu correo antes de iniciar sesión.", reset: "Contraseña restablecida. Iniciá sesión con tu nueva contraseña.", changed: "Contraseña cambiada. Iniciá sesión nuevamente.", logout: "Sesión cerrada correctamente." };
const passwordHint = "Usá entre 8 y 128 caracteres. Podés incluir espacios y caracteres Unicode. La contraseña no se recorta.";

export function AccountForm({ mode }: { mode: Mode }) {
  const auth = useAuth();
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const headingId = useId();
  const initialized = useRef(false);
  const resetToken = useRef<string | null>(null);
  const [tokenReady, setTokenReady] = useState(mode !== "reset");
  const { busy, errors, error, setError, success, setSuccess, handleSubmit, handleChange } = useFormSubmission({
    fields,
    validate: (values) => {
      const nextErrors: Partial<Record<Field, string>> = {};
      const check = (key: Field, issue: string | undefined) => { if (issue) nextErrors[key] = issue; };
      if (["login", "register", "forgot"].includes(mode)) check("email", validateEmail(values.email));
      if (mode === "register") check("displayName", validateDisplayName(values.displayName));
      if (mode === "login") check("password", validateCurrentPassword(values.password));
      if (mode === "register") check("password", validateNewPassword(values.password));
      if (["reset", "change"].includes(mode)) {
        check("newPassword", validateNewPassword(values.newPassword));
        if (values.confirmPassword !== values.newPassword) nextErrors.confirmPassword = "Las contraseñas no coinciden.";
      }
      if (mode === "change") {
        check("currentPassword", validateCurrentPassword(values.currentPassword));
        if (values.newPassword === values.currentPassword) nextErrors.newPassword = "La nueva contraseña debe ser diferente de la actual.";
      }
      return nextErrors;
    },
    onSubmit: async (values, form) => {
      if (mode === "reset" && !resetToken.current) throw new Error("El enlace de recuperación no es válido. Solicitá uno nuevo.");
      if (mode === "register") {
        await auth.register({ email: values.email, displayName: values.displayName, password: values.password });
        form.reset();
        router.replace("/login?notice=registered");
      } else if (mode === "login") {
        const origin = new URL(window.location.href).searchParams.get("returnTo");
        const account = await auth.login({ email: values.email, password: values.password });
        form.reset();
        router.replace(roleDestination(account.role, origin));
      } else if (mode === "forgot") {
        const message = await auth.forgotPassword({ email: values.email });
        form.reset();
        setSuccess(message);
      } else if (mode === "reset") {
        try {
          await auth.resetPassword({ token: resetToken.current!, newPassword: values.newPassword });
        } catch (failure) {
          if (typeof failure === "object" && failure !== null && "status" in failure && failure.status === 400) { resetToken.current = null; setTokenReady(false); }
          throw failure;
        }
        resetToken.current = null;
        setTokenReady(false);
        form.reset();
        router.replace("/login?notice=reset");
      } else {
        await auth.changePassword({ currentPassword: values.currentPassword, newPassword: values.newPassword });
        form.reset();
        router.replace("/login?notice=changed");
      }
    },
    fallbackError: "No pudimos completar la solicitud. Intentá nuevamente.",
  });

  useEffect(() => {
    if (initialized.current) return;
    initialized.current = true;
    if (mode === "reset") {
      const url = new URL(window.location.href);
      const tokens = url.searchParams.getAll("token");
      resetToken.current = tokens.length === 1 && /^[A-Za-z0-9_-]{43}$/.test(tokens[0] ?? "") ? tokens[0]! : null;
      // Preserve the credential only in memory. Also remove fragments and unrelated query data.
      window.history.replaceState(window.history.state, "", url.pathname);
      setTokenReady(resetToken.current !== null);
      if (!resetToken.current) setError("El enlace de recuperación no es válido. Solicitá uno nuevo.");
    }
    if (mode === "login") {
      const notice = new URL(window.location.href).searchParams.get("notice");
      setSuccess(notice ? messages[notice] ?? "" : "");
    }
  }, [mode, setError, setSuccess]);

  const hasEmail = ["register", "login", "forgot"].includes(mode);
  return <section aria-labelledby={headingId}><PageHeader id={headingId} title={titles[mode]} />
    {mode === "login" ? <p className="intro">Tu próximo paso empieza acá. Ingresá a tu cuenta.</p> : null}
    {mode === "register" ? <p className="intro">Registrate con tu correo @alu.frlp.utn.edu.ar. Te enviaremos un enlace para verificarlo antes de que puedas iniciar sesión.</p> : null}
    {mode === "forgot" ? <p className="intro">Ingresá tu email y te enviaremos instrucciones para recuperar el acceso.</p> : null}
    {mode === "reset" ? <p className="intro">Al restablecer tu contraseña se cerrarán todas tus sesiones. Si recargás esta página, volvé a abrir el enlace del email.</p> : null}
    {mode === "change" ? <p className="intro">El cambio cerrará todas tus sesiones, incluida esta.</p> : null}
    {mode === "login" && !auth.coordinationAvailable ? <Notice tone="warning">{COORDINATION_NOTICE}</Notice> : null}
    {error ? <Notice tone="error" focusOnShow>{error}</Notice> : null}
    {success ? <Notice tone="success">{success}</Notice> : null}
    <form ref={formRef} onSubmit={handleSubmit} onChange={handleChange} noValidate aria-busy={busy}>
      {mode === "register" ? <FormField name="displayName" label="Nombre visible" input={{ autoComplete: "nickname" }} error={errors.displayName} /> : null}
      {hasEmail ? <FormField name="email" label="Email" input={{ type: "email", autoComplete: mode === "login" ? "username" : "email" }} error={errors.email} /> : null}
      {["login", "register"].includes(mode) ? <FormField name="password" label="Contraseña" input={{ type: "password", autoComplete: mode === "login" ? "current-password" : "new-password" }} error={errors.password} hint={mode === "register" ? passwordHint : undefined} /> : null}
      {mode === "change" ? <FormField name="currentPassword" label="Contraseña actual" input={{ type: "password", autoComplete: "current-password" }} error={errors.currentPassword} /> : null}
      {["reset", "change"].includes(mode) ? <><FormField name="newPassword" label="Nueva contraseña" input={{ type: "password", autoComplete: "new-password" }} error={errors.newPassword} hint={passwordHint} /><FormField name="confirmPassword" label="Confirmar contraseña" input={{ type: "password", autoComplete: "new-password" }} error={errors.confirmPassword} /></> : null}
      <button className="button submit" disabled={busy || !tokenReady}>{busy ? "Enviando…" : actions[mode]}</button>
    </form>
    {mode === "change" ? <div className="form-links"><Link href="/account">Volver a mi perfil</Link></div> : null}
    <div className="form-links">{mode === "login" ? <><Link href="/register">Crear una cuenta</Link><Link href="/forgot-password">¿Olvidaste tu contraseña?</Link></> : null}{["forgot", "register", "reset"].includes(mode) ? <Link href="/login">Volver al login</Link> : null}{mode === "reset" ? <Link href="/forgot-password">Solicitar un nuevo enlace de recuperación</Link> : null}</div>
    {["login", "register"].includes(mode) ? <div className="form-links"><Link href="/resend-verification">¿No verificaste tu correo? Solicitar un nuevo enlace</Link></div> : null}
  </section>;
}
