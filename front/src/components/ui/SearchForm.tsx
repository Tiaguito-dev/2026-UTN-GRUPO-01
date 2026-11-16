"use client";

import { Search } from "lucide-react";
import { useId, useState, type FormEvent } from "react";
import { validateMateriaSearch } from "@/validations/materias";
import styles from "./SearchForm.module.css";

/**
 * Name search submitted with a button, shared by Materias and Profesores. Validation (length and
 * control characters) runs on submit; `onSearch` receives the trimmed text. Remount it with a
 * `key` when the URL query changes so the field shows the active search.
 */
export function SearchForm({ query, placeholder, label = "Buscar por nombre", onSearch, className }: {
  query: string;
  placeholder: string;
  label?: string;
  onSearch: (q: string) => void;
  className?: string;
}) {
  const searchId = useId();
  const [value, setValue] = useState(query);
  const [error, setError] = useState("");
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const issue = validateMateriaSearch(value);
    setError(issue ?? "");
    if (!issue) onSearch(value.trim());
  }
  return <form className={className ? `${styles.search} ${className}` : styles.search} onSubmit={submit} noValidate role="search">
    <label htmlFor={searchId}>{label}</label>
    <div className={styles.searchControls}>
      <div className={styles.searchInput}><Search className={styles.searchIcon} aria-hidden="true" focusable="false" size={18} strokeWidth={1.75} /><input id={searchId} name="q" type="search" value={value} onChange={(event) => setValue(event.target.value)} placeholder={placeholder} aria-invalid={Boolean(error)} aria-describedby={error ? `${searchId}-error` : undefined} /></div>
      <button className={`button ${styles.searchButton}`} type="submit">Buscar</button>
    </div>
    {error ? <p id={`${searchId}-error`} role="alert" className="field-error">{error}</p> : null}
  </form>;
}
