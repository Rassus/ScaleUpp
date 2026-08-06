/**
 * Base URL de la API.
 * - Web/dev con Vite proxy: vacío → rutas relativas `/api/v1`
 * - APK / QA: definir en `.env.production` (ej. https://scaleupp.onrender.com)
 */
export const API_BASE = (import.meta.env.VITE_API_BASE_URL as string | undefined)?.replace(
  /\/$/,
  "",
) ?? "";

export function apiUrl(path: string): string {
  const p = path.startsWith("/") ? path : `/${path}`;
  return `${API_BASE}${p}`;
}

export function apiErrorMessage(body: unknown, fallback: string): string {
  if (!body || typeof body !== "object") return fallback;
  const detail = (body as { detail?: unknown }).detail;
  if (typeof detail === "string") return detail;
  if (Array.isArray(detail)) {
    const parts = detail
      .map((d) => {
        if (typeof d === "string") return d;
        if (d && typeof d === "object" && "msg" in d)
          return String((d as { msg: unknown }).msg);
        return null;
      })
      .filter(Boolean);
    if (parts.length) return parts.join("; ");
  }
  return fallback;
}

/** Interpreta fallos de fetch (red, CORS, 4xx/5xx) con mensaje usable en UI. */
export async function readFetchError(
  res: Response | null,
  err: unknown,
  fallback: string,
): Promise<string> {
  if (err instanceof TypeError) {
    const msg = err.message || "";
    if (/failed to fetch|networkerror|load failed/i.test(msg)) {
      return (
        "No se pudo conectar con el servidor. " +
        "Si ves un error CORS en la consola, el API falló o no responde; " +
        "prueba de nuevo en unos segundos."
      );
    }
    return msg || fallback;
  }
  if (res) {
    const body = await res.json().catch(() => null);
    if (res.status === 401) {
      return apiErrorMessage(body, "Credenciales inválidas");
    }
    if (res.status === 403) {
      return apiErrorMessage(body, "No tienes permiso para esta acción");
    }
    if (res.status === 422) {
      return apiErrorMessage(body, "Datos inválidos");
    }
    if (res.status >= 500) {
      return apiErrorMessage(
        body,
        `Error del servidor (${res.status}). Intenta de nuevo.`,
      );
    }
    return apiErrorMessage(body, `${fallback} (${res.status})`);
  }
  if (err instanceof Error && err.message) return err.message;
  return fallback;
}
