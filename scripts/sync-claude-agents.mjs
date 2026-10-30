#!/usr/bin/env node
// Genera .claude/agents/{back,front,test}.md desde .agents/*.md.
// .agents/*.md es la fuente de verdad (agnóstica de herramienta, ver .agents/OVERVIEW.md);
// esto solo arma el wiring específico de Claude Code (frontmatter + pointer) para no
// mantenerlo a mano en dos lugares.
// ponytail: regex simple sobre markdown, no parser completo — si cambia el formato de
// .agents/*.md, ajustar section()/bullets() de abajo.
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

const AGENTS = {
  back: { label: "Backend", dominio: "backend" },
  front: { label: "Frontend", dominio: "frontend" },
  test: { label: "Testing", dominio: "testing" },
};

function section(md, heading) {
  const m = md.match(new RegExp(`## ${heading}\\n\\n([\\s\\S]*?)(?=\\n## |$)`));
  return m ? m[1].trim() : "";
}

function bullets(block) {
  return block
    .split("\n")
    .filter((l) => l.startsWith("- "))
    .map((l) => l.slice(2).trim());
}

for (const [name, { label, dominio }] of Object.entries(AGENTS)) {
  const srcPath = join(root, ".agents", `${name}.md`);
  const src = readFileSync(srcPath, "utf8").replace(/\r\n/g, "\n");

  const stripDot = (s) => s.replace(/\.$/, "");
  const rol = section(src, "Rol").split("\n")[0];
  const alcance = bullets(section(src, "Alcance")).map(stripDot).join(", ");
  const fueraDeAlcance = bullets(section(src, "Fuera de Alcance")).map(stripDot).join("; ");

  const out = `---
name: ${name}
description: ${rol} Usar para tareas de ${dominio} ya planificadas y bien definidas, delegadas desde la sesión principal.
tools: Read, Edit, Write, Glob, Grep, Bash
---

Sos el agente de ${label} de este repositorio. Tu perfil completo (rol, alcance, fuera de
alcance, estándares) vive en \`.agents/${name}.md\` — leelo antes de empezar cualquier tarea, es
la fuente de verdad y no se duplica acá.

Antes de tocar código:

1. Confirmá que la tarea cumple el "Gate de tarea" de \`.agents/OVERVIEW.md\`: bien definida, con
   las decisiones no triviales (cuando aplican) documentadas dentro de la propia tarea. Si no
   está, completala ahí primero.
2. Para git, seguí \`.agents/skills/commit-work/SKILL.md\` al pie de la letra — incluye cuándo
   hay que pedir confirmación antes de pushear o mergear. No asumas autorización de más.

Alcance: ${alcance}.
Fuera de alcance: ${fueraDeAlcance}.
`;

  const destDir = join(root, ".claude", "agents");
  mkdirSync(destDir, { recursive: true });
  writeFileSync(join(destDir, `${name}.md`), out);
  console.log(`✓ .claude/agents/${name}.md generado desde .agents/${name}.md`);
}

console.log("\npo.md es personal y no se genera — ver .agents/OVERVIEW.md.");
