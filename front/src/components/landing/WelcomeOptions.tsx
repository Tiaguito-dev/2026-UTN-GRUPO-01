"use client";

import { BrandLoading } from "@/components/ui/BrandLoading";
import Link from "next/link";
import { ArrowLeft, ArrowRight, MessagesSquare, PencilLine, Search } from "lucide-react";
import { useEffect, useId, useRef, useState, type FormEvent } from "react";
import { BrandMark } from "@/components/BrandMark";
import { Notice } from "@/components/ui/Notice";
import { experienciasHref } from "@/validations/feedback";
import { listarExperienciasExplorador, listarMateriasExplorador, type ExperienciaExplorador, type MateriaExplorador } from "@/services/subject-preview";

const choices = [
  { id: "explore", label: "Explorar materias", description: "Buscá por nombre y seguí al catálogo para conocer las cursadas.", icon: Search },
  { id: "read", label: "Leer experiencias", description: "Elegí una materia y leé hasta cinco experiencias recientes.", icon: MessagesSquare },
  { id: "share", label: "Compartir mi experiencia", description: "Contá cómo fue tu cursada y ayudá a quienes vienen después.", icon: PencilLine },
] as const;
type Step = "options" | typeof choices[number]["id"];
type LoadState<T> = { status: "idle" | "loading" | "error" } | { status: "ready"; items: T[] };
const formatDate = new Intl.DateTimeFormat("es-AR", { dateStyle: "long", timeZone: "America/Argentina/Buenos_Aires" });
const loginFor = (destination: string) => "/login?" + new URLSearchParams({ returnTo: destination });

export function WelcomeOptions() {
  const [step, setStep] = useState<Step>("options");
  const [intro, setIntro] = useState(true);
  const heading = useRef<HTMLHeadingElement>(null);
  const navigated = useRef(false);
  const choicesId = useId();
  useEffect(() => { if (navigated.current) heading.current?.focus(); }, [step]);
  function go(next: Step) {
    navigated.current = true;
    setIntro(false);
    setStep(next);
  }

  return <div className={intro ? "guided-welcome guided-entry" : "guided-welcome"} id="public-welcome" onFocusCapture={(event) => {
    if (event.target.matches(":focus-visible")) setIntro(false);
  }}>
    <nav className="guided-access" aria-label="Acceso a la cuenta">
      <Link href="/login" className="button button-secondary guided-login">Iniciar sesión <ArrowRight aria-hidden="true" size={16} /></Link>
    </nav>
    <div className="guided-brand-row">
      <Link href="/" className="brand guided-brand" onClick={(event) => { event.preventDefault(); go("options"); }}>
        <span className="brand-mark" aria-hidden="true"><BrandMark /></span><span>Professors&apos; butchery</span>
      </Link>
    </div>
    {step === "options" ? <>
      <div className="guided-intro">
        <p className="eyebrow">De estudiantes, para estudiantes</p>
        <h1 ref={heading} tabIndex={-1}>¿Qué querés hacer hoy?</h1>
        <p>Elegí cómo empezar. Podés explorar materias y leer experiencias sin crear una cuenta.</p>
      </div>
      <ul className="guided-choices">
        {choices.map(({ id, label, description, icon: Icon }, index) => <li key={id} onAnimationEnd={index === choices.length - 1 ? () => setIntro(false) : undefined}>
          <button type="button" className="button guided-choice" aria-labelledby={choicesId + "-choice-" + id} aria-describedby={choicesId + "-description-" + id} onClick={() => go(id)}>
            <span className="guided-choice-top"><span className="guided-choice-icon"><Icon aria-hidden="true" size={24} /></span></span>
            <span id={choicesId + "-choice-" + id} className="guided-choice-title">{label}</span>
            <span id={choicesId + "-description-" + id} className="guided-choice-description">{description}</span>
            <ArrowRight className="guided-choice-arrow" aria-hidden="true" size={20} />
          </button>
        </li>)}
      </ul>
    </> : <section className="guided-step" aria-labelledby="guided-step-title">
      <button type="button" className="button button-secondary guided-back" onClick={() => go("options")}><ArrowLeft aria-hidden="true" size={16} /> Volver a las opciones</button>
      <h1 ref={heading} id="guided-step-title" tabIndex={-1}>{choices.find((item) => item.id === step)?.label}</h1>
      {step !== "share" ? <SearchSubjects /> : <div className="guided-panel">
        <p>Iniciá sesión y elegí la materia, cursada y comisión de la experiencia que querés compartir.</p>
        <div className="actions"><Link href={loginFor("/home/materias")} className="button">Iniciar sesión</Link><Link href="/register" className="button button-secondary">Crear cuenta</Link></div>
      </div>}
    </section>}
  </div>;
}

function SearchSubjects() {
  const searchId = useId();
  const [input, setInput] = useState("");
  const [result, setResult] = useState<LoadState<MateriaExplorador>>({ status: "idle" });
  const [selected, setSelected] = useState<MateriaExplorador | null>(null);
  const version = useRef(0);
  useEffect(() => () => { version.current += 1; }, []);
  async function search() {
    const id = ++version.current;
    setSelected(null);
    setResult({ status: "loading" });
    try {
      const { items } = await listarMateriasExplorador(input.trim());
      if (id === version.current) setResult({ status: "ready", items });
    } catch {
      if (id === version.current) setResult({ status: "error" });
    }
  }
  function submit(event: FormEvent<HTMLFormElement>) { event.preventDefault(); void search(); }

  return <div className="guided-panel">
    <form className="guided-search" role="search" aria-label="Buscar materias" onSubmit={submit}>
      <div><label htmlFor={searchId}>¿Qué materia querés conocer?</label><input id={searchId} type="search" placeholder="Ej. Sistemas Operativos" value={input} maxLength={150} onChange={(event) => setInput(event.target.value)} /></div>
      <button className="button" type="submit">Buscar materia</button>
    </form>
    {result.status === "loading" ? <BrandLoading message="Cargando materias…" /> : null}
    {result.status === "error" ? <Notice tone="error">No pudimos cargar las materias. <button className="button button-secondary" type="button" onClick={() => void search()}>Reintentar</button></Notice> : null}
    {result.status === "ready" ? <>
      <p role="status">{result.items.length ? "Materias encontradas: " + result.items.length : "No encontramos materias para esa búsqueda."}</p>
      {result.items.length ? <ul className="guided-results">{result.items.map((item) => <li key={item.id}><button className="button button-secondary" type="button" aria-pressed={selected?.id === item.id} onClick={() => setSelected(item)}>{item.nombre}</button></li>)}</ul> : null}
    </> : null}
    {selected ? <RecentExperiences key={selected.id} materia={selected} /> : null}
    <Link className="button button-secondary guided-details-link" href={loginFor("/home/materias")}>Iniciá sesión para ver el catálogo completo</Link>
  </div>;
}

function RecentExperiences({ materia }: { materia: MateriaExplorador }) {
  const titleId = useId();
  const [result, setResult] = useState<LoadState<ExperienciaExplorador>>({ status: "loading" });
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let active = true;
    void listarExperienciasExplorador(materia.id).then(({ items }) => { if (active) setResult({ status: "ready", items }); }, () => { if (active) setResult({ status: "error" }); });
    return () => { active = false; };
  }, [attempt, materia.id]);

  return <section aria-labelledby={titleId}>
    <h2 id={titleId}>Experiencias de {materia.nombre}</h2>
    {result.status === "loading" ? <BrandLoading message="Cargando experiencias…" /> : null}
    {result.status === "error" ? <Notice tone="error">No pudimos cargar las experiencias. <button className="button button-secondary" type="button" onClick={() => { setResult({ status: "loading" }); setAttempt((value) => value + 1); }}>Reintentar</button></Notice> : null}
    {result.status === "ready" ? result.items.length ? <ul className="guided-results" aria-label="Experiencias recientes">
      {result.items.map((item) => <li key={item.id}><p>{item.texto}</p><time dateTime={item.createdAt}>{formatDate.format(new Date(item.createdAt))}</time></li>)}
    </ul> : <p role="status">Todavía no hay experiencias publicadas.</p> : null}
    <Link className="button button-secondary guided-details-link" href={loginFor(experienciasHref(undefined, materia.id))}>Iniciar sesión para leer más</Link>
  </section>;
}
