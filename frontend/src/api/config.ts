/**
 * Base URL de la API.
 * - Web/dev con Vite proxy: vacío → rutas relativas `/api/v1`
 * - APK / dispositivo: definir VITE_API_BASE_URL=http://IP_PC:8000
 */
export const API_BASE = (import.meta.env.VITE_API_BASE_URL as string | undefined)?.replace(
  /\/$/,
  "",
) ?? "";

export function apiUrl(path: string): string {
  const p = path.startsWith("/") ? path : `/${path}`;
  return `${API_BASE}${p}`;
}
