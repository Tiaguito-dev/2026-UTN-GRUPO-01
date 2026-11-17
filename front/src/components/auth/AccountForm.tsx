"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useId, useRef, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useFormSubmission } from "@/hooks/useFormSubmission";
import { COORDINATION_NOTICE } from "@/services/session-coordinator";
import { validateEmail, validateNewPassword, validateDisplayName, validateCurrentPassword, validarAceptacionTerminos } from "@/validations/auth";
import { roleDestination } from "@/lib/navigation";
import { FormField } from "@/components/ui/FormField";
import { Notice } from "@/components/ui/Notice";
import { PageHeader } from "@/components/ui/PageHeader";
import { Dialog } from "@/components/ui/Dialog";
import { obtenerTerminosCondiciones } from "@/services/terminos";
import { HttpError } from "@/services/http";
import type { TerminosCondiciones } from "@/types/auth";
import styles from "./TerminosRegistro.module.css";

type Mode = "login" | "register" | "forgot" | "reset" | "change";
type Field = "email" | "displayName" | "password" | "currentPassword" | "newPassword" | "confirmPassword" | "aceptaTerminos";
const fields: Field[] = ["email", "displayName", "password", "currentPassword", "newPassword", "confirmPassword", "aceptaTerminos"];
const titles: Record<Mode, string> = { login: "Iniciar sesión", register: "Crear cuenta", forgot: "Recuperar contraseña", reset: "Restablecer contraseña", change: "Cambiar contraseña" };
const actions: Record<Mode, string> = { login: "Iniciar sesión", register: "Crear cuenta", forgot: "Enviar instrucciones", reset: "Restablecer contraseña", change: "Cambiar contraseña" };
const messages: Record<string, string> = { registered: "Cuenta creada, pendiente de verificación. Enviamos un enlace a tu correo institucional. Revisá tu bandeja de entrada y spam y verificá tu correo antes de iniciar sesión.", reset: "Contraseña restablecida. Iniciá sesión con tu nueva contraseña.", changed: "Contraseña cambiada. Iniciá sesión nuevamente.", logout: "Sesión cerrada correctamente.", idle: "Tu sesión se cerró por inactividad. Iniciá sesión nuevamente.", absolute: "Tu sesión alcanzó su duración máxima. Iniciá sesión nuevamente.", expired: "Tu sesión terminó. Iniciá sesión nuevamente." };
const passwordHint = "Usá entre 8 y 128 caracteres. Podés incluir espacios y caracteres Unicode. La contraseña no se recorta.";

export function AccountForm({ mode }: { mode: Mode }) {
  const auth = useAuth();
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const headingId = useId();
  const initialized = useRef(false);
  const resetToken = useRef<string | null>(null);
  const [tokenReady, setTokenReady] = useState(mode !== "reset");
  const termsId = useId();
  const [terminos, setTerminos] = useState<TerminosCondiciones | null>(null);
  const [termsError, setTermsError] = useState("");
  const [termsAttempt, setTermsAttempt] = useState(0);
  const [aceptaTerminos, setAceptaTerminos] = useState(false);
  const [mostrarTerminos, setMostrarTerminos] = useState(false);
  useEffect(() => {
    if (mode !== "register") return;
    let active = true;
    obtenerTerminosCondiciones().then((documento) => {
      if (active) { setTerminos(documento); setTermsError(""); }
    }).catch((failure: unknown) => {
      if (active) setTermsError(failure instanceof Error ? failure.message : "No pudimos cargar los términos y condiciones.");
    });
    return () => { active = false; };
  }, [mode, termsAttempt]);
  function recargarTerminos() {
    setTerminos(null); setTermsError(""); setAceptaTerminos(false); setMostrarTerminos(false);
    setTermsAttempt(value => value + 1);
  }
  const { busy, errors, error, setError, success, setSuccess, handleSubmit, handleChange } = useFormSubmission({
    fields,
    validate: (values) => {
      const nextErrors: Partial<Record<Field, string>> = {};
      const check = (key: Field, issue: string | undefined) => { if (issue) nextErrors[key] = issue; };
      if (["login", "register", "forgot"].includes(mode)) check("email", validateEmail(values.email));
      if (mode === "register") check("displayName", validateDisplayName(values.displayName));
      if (mode === "login") check("password", validateCurrentPassword(values.password));
      if (mode === "register") check("password", validateNewPassword(values.password));
      if (mode === "register") {
        check("aceptaTerminos", validarAceptacionTerminos(values.aceptaTerminos === "true"));
        if (!terminos && !nextErrors.aceptaTerminos) nextErrors.aceptaTerminos = "Esperá a que se carguen los términos y condiciones antes de crear tu cuenta.";
      }
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
        if (!terminos) throw new Error("No pudimos cargar los términos y condiciones. Intentá nuevamente.");
        try {
          await auth.register({ email: values.email, displayName: values.displayName, password: values.password, aceptaTerminos: values.aceptaTerminos === "true", versionTerminos: terminos.version });
        } catch (failure) {
          if (failure instanceof HttpError && failure.status === 400 && failure.message === "Los términos y condiciones cambiaron. Leelos nuevamente y aceptá la versión vigente.") recargarTerminos();
          throw failure;
        }
        form.reset();
        setAceptaTerminos(false);
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
      {mode === "register" ? <div>
        <label className={styles.acceptance} htmlFor={termsId}>
          <input className={styles.checkbox} id={termsId} name="aceptaTerminos" type="checkbox" value="true" checked={aceptaTerminos}
            onChange={event => setAceptaTerminos(event.target.checked)} required disabled={busy || !terminos}
            aria-invalid={Boolean(errors.aceptaTerminos)} aria-describedby={errors.aceptaTerminos ? `${termsId}-error` : undefined} />
          <span>He leído y acepto los <a className={styles.link} href={`#${termsId}-documento`} aria-haspopup="dialog" aria-disabled={!terminos}
            onClick={event => { event.preventDefault(); if (terminos) { event.currentTarget.focus(); setMostrarTerminos(true); } }}>Términos y condiciones</a></span>
        </label>
        {errors.aceptaTerminos ? <p className="field-error" id={`${termsId}-error`}>{errors.aceptaTerminos}</p> : null}
        {!terminos && !termsError ? <p role="status" className={styles.status}>Cargando términos y condiciones…</p> : null}
        {termsError ? <Notice tone="error">{termsError} <button className="button button-secondary" type="button" onClick={recargarTerminos}>Reintentar términos y condiciones</button></Notice> : null}
      </div> : null}
      <button className="button submit" disabled={busy || !tokenReady}>{busy ? "Enviando…" : actions[mode]}</button>
    </form>
    {mode === "register" && terminos && mostrarTerminos ? <Dialog open onClose={() => setMostrarTerminos(false)} title="Términos y condiciones" description={`Versión ${terminos.version}`}>
      {/* eslint-disable-next-line jsx-a11y/no-noninteractive-tabindex -- La región desplazable recibe foco para leer y desplazar los términos con teclado. */}
      <div id={`${termsId}-documento`} className={styles.document} role="region" aria-label="Texto de los términos y condiciones" tabIndex={0} data-autofocus>
        {terminos.secciones.map((seccion, index) => <section className={styles.section} key={`${index}-${seccion.titulo}`} aria-labelledby={`${termsId}-seccion-${index}`}>
          <h3 id={`${termsId}-seccion-${index}`}>{seccion.titulo}</h3>
          {seccion.parrafos.map((parrafo, paragraph) => <p key={`${index}-${paragraph}`}>{parrafo}</p>)}
        </section>)}
      </div>
      <div className="dialog-actions"><button className="button" type="button" onClick={() => setMostrarTerminos(false)}>Cerrar</button></div>
    </Dialog> : null}
    {mode === "change" ? <div className="form-links"><Link href="/account">Volver a mi perfil</Link></div> : null}
    <div className="form-links">{mode === "login" ? <><Link href="/register">Crear una cuenta</Link><Link href="/forgot-password">¿Olvidaste tu contraseña?</Link></> : null}{["forgot", "register", "reset"].includes(mode) ? <Link href="/login">Volver al login</Link> : null}{mode === "reset" ? <Link href="/forgot-password">Solicitar un nuevo enlace de recuperación</Link> : null}</div>
    {["login", "register"].includes(mode) ? <div className="form-links"><Link href="/resend-verification">¿No verificaste tu correo? Solicitar un nuevo enlace</Link></div> : null}
  </section>;
}
