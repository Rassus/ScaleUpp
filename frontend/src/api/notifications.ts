import { Capacitor } from "@capacitor/core";
import { LocalNotifications } from "@capacitor/local-notifications";
import { apiUrl } from "./config";
import { isNativeApp } from "./platform";

export type AvisoPendiente = {
  tipo: "STOCK_BAJO" | "POR_VENCER" | "PAGO_GRACIA";
  clave: string;
  titulo: string;
  cuerpo: string;
  periodo_ym: string;
  producto_id?: number | null;
  pago_id?: number | null;
};

function authHeaders(token: string, negocioId: number): HeadersInit {
  return {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
    "X-Negocio-Id": String(negocioId),
  };
}

async function ensurePermissions(): Promise<boolean> {
  if (isNativeApp()) {
    const perm = await LocalNotifications.checkPermissions();
    if (perm.display === "granted") return true;
    const req = await LocalNotifications.requestPermissions();
    return req.display === "granted";
  }
  if (typeof Notification === "undefined") return false;
  if (Notification.permission === "granted") return true;
  if (Notification.permission === "denied") return false;
  const result = await Notification.requestPermission();
  return result === "granted";
}

async function ensureChannel() {
  if (!isNativeApp()) return;
  try {
    await LocalNotifications.createChannel({
      id: "scaleupp-avisos",
      name: "Avisos ScaleUpp",
      description: "Stock, caducidad y pagos",
      importance: 4,
      visibility: 1,
      vibration: true,
    });
  } catch {
    // canal ya existe / plataforma no soporta
  }
}

async function showNative(avisos: AvisoPendiente[]) {
  const base = Date.now() % 100000;
  await LocalNotifications.schedule({
    notifications: avisos.map((a, i) => ({
      id: base + i + 1,
      title: a.titulo,
      body: a.cuerpo,
      channelId: "scaleupp-avisos",
      extra: {
        tipo: a.tipo,
        clave: a.clave,
      },
    })),
  });
}

async function showWeb(avisos: AvisoPendiente[]) {
  for (const a of avisos) {
    try {
      new Notification(a.titulo, {
        body: a.cuerpo,
        tag: `scaleupp-${a.tipo}-${a.clave}-${a.periodo_ym}`,
      });
    } catch {
      // ignore
    }
  }
}

/**
 * Obtiene avisos pendientes (1/mes por producto o pago), los muestra
 * como notificación local/web y los marca como enviados.
 */
export async function syncAvisosPush(opts: {
  token: string;
  negocioId: number;
}): Promise<number> {
  const { token, negocioId } = opts;
  try {
    const res = await fetch(apiUrl("/api/v1/avisos/pendientes"), {
      headers: authHeaders(token, negocioId),
    });
    if (!res.ok) return 0;
    const avisos = (await res.json()) as AvisoPendiente[];
    if (!avisos.length) return 0;

    const ok = await ensurePermissions();
    if (!ok) return 0;

    if (isNativeApp() || Capacitor.isNativePlatform()) {
      await ensureChannel();
      await showNative(avisos);
    } else {
      await showWeb(avisos);
    }

    await fetch(apiUrl("/api/v1/avisos/ack"), {
      method: "POST",
      headers: authHeaders(token, negocioId),
      body: JSON.stringify({
        avisos: avisos.map((a) => ({
          tipo: a.tipo,
          clave: a.clave,
          titulo: a.titulo,
          cuerpo: a.cuerpo,
        })),
      }),
    });
    return avisos.length;
  } catch {
    return 0;
  }
}
