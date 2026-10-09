export class HttpError extends Error {
  readonly temporary: boolean;
  constructor(readonly status: number, message: string) {
    super(message);
    this.name = "HttpError";
    this.temporary = status === 0 || status === 429 || status >= 500;
  }
}

function apiOrigin(): string {
  const configured = process.env.NEXT_PUBLIC_API_URL;
  if (!configured) throw new HttpError(0, "Falta configurar la conexión con el servidor.");
  let url: URL;
  try { url = new URL(configured); } catch { throw new HttpError(0, "La configuración del servidor no es válida."); }
  const local = ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname);
  if (url.username || url.password || url.search || url.hash || url.pathname !== "/" || (url.protocol !== "https:" && !(url.protocol === "http:" && local && process.env.NEXT_PUBLIC_ALLOW_LOCAL_HTTP === "true"))) throw new HttpError(0, "La configuración del servidor requiere HTTPS o HTTP local explícito.");
  return url.origin;
}

/** No credentials are available to JavaScript: the browser owns both HttpOnly cookies. */
export async function requestJson<T>(path: string, options: { method?: "GET" | "POST"; body?: unknown } = {}): Promise<T> {
  const method = options.method ?? "GET";
  let response: Response;
  try {
    response = await fetch(`${apiOrigin()}${path}`, {
      method,
      credentials: "include",
      cache: "no-store",
      signal: AbortSignal.timeout(15_000),
      headers: method === "GET" ? { Accept: "application/json" } : { Accept: "application/json", "Content-Type": "application/json", "X-CSRF-Protection": "1" },
      ...(options.body === undefined ? {} : { body: JSON.stringify(options.body) }),
    });
  } catch (error) {
    if (error instanceof HttpError) throw error;
    throw new HttpError(0, "Lo sentimos. No pudimos comunicarnos con el servidor, intentá nuevamente.");
  }
  let body: unknown;
  if (response.status !== 204) {
    try { body = await response.json(); } catch { body = undefined; }
  }
  if (!response.ok) {
    const message = body && typeof body === "object" && "message" in body && typeof body.message === "string" ? body.message : "Lo sentimos. No pudimos completar la solicitud, intentá nuevamente.";
    throw new HttpError(response.status, message);
  }
  return body as T;
}
