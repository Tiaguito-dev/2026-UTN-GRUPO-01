// Smoke de enrutamiento contra el stack publicado. No usa cookies ni modifica datos.
// Uso: node scripts/check-admin-proxy.mjs [http://localhost:8080]
const base = new URL(process.argv[2] ?? process.env.ADMIN_PROXY_BASE_URL ?? "http://localhost:8080");
if (!["http:", "https:"].includes(base.protocol) || base.username || base.password || base.search || base.hash || base.pathname !== "/") {
  throw new Error("Indique solamente el origen HTTP(S) del proxy, sin credenciales ni parámetros.");
}

const id = "00000000-0000-4000-8000-000000000001";
const modules = ["materias", "profesores", "cursadas", "comisiones", "users", "feedback"];
const apiChecks = [
  ...modules.map((module) => ({ method: "GET", path: `/admin/${module}/${id}/detalle?page=1&pageSize=3` })),
  { method: "GET", path: `/users/${id}/historial` },
  { method: "PATCH", path: `/users/${id}/estado` },
  { method: "GET", path: `/profesores/${id}` },
  { method: "GET", path: `/profesores/${id}/historial` },
];
const pages = ["materias", "profesores", "cursadas", "comisiones", "usuarios", "experiencias"];
let failures = 0;

async function check({ method = "GET", path }, backend) {
  try {
    const response = await fetch(new URL(path, base), {
      method,
      redirect: "manual",
      signal: AbortSignal.timeout(10000),
      headers: { Origin: base.origin, "X-CSRF-Protection": "1", ...(method === "PATCH" ? { "Content-Type": "application/json" } : {}) },
      // Fetch de Node no tiene cookie jar: esta operación no puede autenticarse.
      ...(method === "PATCH" ? { body: JSON.stringify({ activo: false }) } : {}),
    });
    const type = response.headers.get("content-type") ?? "";
    const body = await response.text();
    const valid = backend
      ? response.status === 401 && type.includes("application/json") && JSON.parse(body).statusCode === 401
      : response.status === 200 && type.includes("text/html");
    if (!valid) failures++;
    console.log(`${valid ? "PASS" : "FAIL"} ${method} ${path}: ${response.status} ${type}`);
  } catch (error) {
    failures++;
    console.error(`FAIL ${method} ${path}: ${error instanceof SyntaxError ? "El backend no devolvió JSON válido." : "No se pudo verificar la respuesta."}`);
  }
}

for (const request of apiChecks) await check(request, true);
for (const module of pages) await check({ path: `/home/admin/${module}` }, false);
if (failures) {
  console.error(`${failures} comprobaciones de enrutamiento fallaron.`);
  process.exitCode = 1;
} else {
  console.log("16 comprobaciones aprobadas: API protegida en backend y páginas en frontend.");
}
