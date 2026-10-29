import { Lock, UserCheck, UserX } from "lucide-react";
import { ROLE_LABEL } from "@/lib/format/role";
import styles from "./UserDetail.module.css";

export function userValue(value: unknown) {
  return typeof value === "string" && value.trim() ? value : "No registrado";
}

export function UserAccountCard({ record, ownAccount, canManage, onManage }: {
  record: Record<string, unknown>; ownAccount: boolean; canManage: boolean; onManage: () => void;
}) {
  const name = userValue(record.displayName);
  const initials = name === "No registrado" ? "?" : name.trim().split(/\s+/u).slice(0, 2).map(part => Array.from(part)[0]).join("").toLocaleUpperCase("es-AR");
  const inactive = Boolean(record.disabledAt);
  const role = record.role === "ADMIN" || record.role === "USER" ? ROLE_LABEL[record.role] : "No registrado";
  return <section className={styles.card} aria-label="Cuenta de usuario">
    <div className={styles.accountHeader}>
      <div className={styles.identity}>
        <span className={styles.avatar} aria-hidden="true">{initials}</span>
        <div className={styles.identityText}>
          <div className={styles.nameRow}><dl className={styles.name}><dt>Nombre público</dt><dd className={name === "No registrado" ? styles.missing : undefined}>{name}</dd></dl>
            <span className={`${styles.status} ${inactive ? styles.inactive : styles.active}`}>{inactive ? "Inactivo" : "Activo"}</span>
          </div>
        </div>
      </div>
      {ownAccount ? <p className={styles.restriction}><Lock size={16} aria-hidden="true" />No podés desactivar tu propia cuenta</p> : canManage ? <button className={`button button-secondary ${inactive ? "" : styles.deactivate}`} type="button" aria-label={`${inactive ? "Reactivar" : "Desactivar"} usuario ${name} (${userValue(record.email)})`} onClick={onManage}>{inactive ? <UserCheck size={18} aria-hidden="true" /> : <UserX size={18} aria-hidden="true" />}{inactive ? "Reactivar usuario" : "Desactivar usuario"}</button> : null}
    </div>
    <dl className={styles.fields}>
      <div><dt>Correo electrónico</dt><dd className={userValue(record.email) === "No registrado" ? styles.missing : undefined}>{userValue(record.email)}</dd></div>
      <div><dt>Rol</dt><dd className={role === "No registrado" ? styles.missing : undefined}>{role}</dd></div>
    </dl>
  </section>;
}
