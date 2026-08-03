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
