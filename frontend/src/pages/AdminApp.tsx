import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { apiUrl } from "../api/config";
import { hashPasswordClient } from "../crypto/password";
import LogoMark from "../components/LogoMark";
import "./AdminApp.css";

type AdminTab = "resumen" | "negocios" | "pagos" | "tickets" | "admin";

type AdminRecaudacionMes = {
  anio: number;
  mes: number;
  etiqueta: string;
  monto_clp: number;
  num_pagos: number;
};

type AdminResumen = {
  negocios_activos: number;
  negocios_suspendidos: number;
  pagos_pendientes: number;
  pagos_vencidos: number;
  pagos_pagados: number;
  monto_pendiente_clp: number;
  monto_recaudado_total_clp?: number;
  monto_recaudado_mes_clp?: number;
  recaudacion_por_mes?: AdminRecaudacionMes[];
  tickets_abiertos?: number;
  resets_pendientes?: number;
};

type AdminConfig = {
  id: number;
  nombre_plan: string;
  cuota_mensual_clp: number;
  cuota_negocio_extra_clp?: number;
  dias_gracia: number;
  dia_facturacion: number;
  activo: boolean;
  actualizado_en: string;
  cuota_diaria_aprox: number;
};

type Prorrateo = {
  periodo_inicio: string;
  periodo_fin: string;
  dias_usados: number;
  dias_base: number;
  cuota_mensual_clp: number;
  cuota_diaria: number;
  monto_prorrateado: number;
  formula: string;
};

type Negocio = {
  id: number;
  nombre: string;
  slug: string;
  comuna?: string | null;
  activo: boolean;
  creado_en: string;
  num_usuarios: number;
  pagos_pendientes: number;
  pagos_vencidos: number;
  ultimo_pago_estado: string | null;
};

type Cuenta = {
  id: number;
  email: string;
  nombre: string;
  activo: boolean;
  rol: string;
  membresia_activa: boolean;
};

type Pago = {
  id: number;
  negocio_id: number;
  negocio_nombre: string;
  negocio_activo: boolean;
  monto: number;
  periodo_inicio: string;
  periodo_fin: string;
  estado: "PENDIENTE" | "PAGADO" | "VENCIDO" | "ANULADO";
  nota: string | null;
  pagado_en: string | null;
  creado_en: string;
  monto_mensual_ref?: number | null;
  dias_usados?: number | null;
  dias_base?: number | null;
};

type TicketAdmin = {
  id: number;
  negocio_id: number;
  negocio_nombre: string;
  usuario_id: number;
  usuario_email: string;
  usuario_nombre: string;
  tipo: "DESUSCRIPCION" | "NUEVO_NEGOCIO";
  estado: "ABIERTO" | "EN_PROCESO" | "RESUELTO" | "RECHAZADO";
  mensaje: string | null;
  nombre_negocio_solicitado: string | null;
  slug_negocio_solicitado: string | null;
  comuna_negocio_solicitado: string | null;
  negocio_creado_id: number | null;
  respuesta_admin: string | null;
  creado_en: string;
  resuelto_en: string | null;
  costo_extra_mensual_clp: number | null;
};

type ResetPasswordAdmin = {
  id: number;
  usuario_id: number;
  email: string;
  usuario_nombre: string;
  estado: "PENDIENTE" | "RESUELTO" | "RECHAZADO";
  nota_admin: string | null;
  creado_en: string;
  resuelto_en: string | null;
};

type AdminAppProps = {
  token: string;
  adminNombre: string;
  adminEmail: string;
  onLogout: () => void;
  onEnterNegocio: (negocioId: number) => void;
};

function authHeaders(token: string): HeadersInit {
  return {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
  };
}

function formatClp(n: number): string {
  return `$${n.toLocaleString("es-CL")} CLP`;
}

function estadoClass(estado: string): string {
  if (estado === "PAGADO") return "ok";
  if (estado === "VENCIDO") return "danger";
  if (estado === "PENDIENTE") return "warn";
  return "muted";
}

export default function AdminApp({
  token,
  adminNombre,
  adminEmail,
  onLogout,
  onEnterNegocio,
}: AdminAppProps) {
  const [tab, setTab] = useState<AdminTab>("resumen");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [resumen, setResumen] = useState<AdminResumen | null>(null);
  const [negocios, setNegocios] = useState<Negocio[]>([]);
  const [pagos, setPagos] = useState<Pago[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [cuentas, setCuentas] = useState<Cuenta[]>([]);

  const [onboardOpen, setOnboardOpen] = useState(false);
  const [obNombre, setObNombre] = useState("");
  const [obSlug, setObSlug] = useState("");
  const [obComuna, setObComuna] = useState("");
  const [obOwnerNombre, setObOwnerNombre] = useState("");
  const [obOwnerEmail, setObOwnerEmail] = useState("");
  const [obOwnerPass, setObOwnerPass] = useState("");
  const [obCrearCuota, setObCrearCuota] = useState(true);

  const [cuentaOpen, setCuentaOpen] = useState(false);
  const [cNombre, setCNombre] = useState("");
  const [cEmail, setCEmail] = useState("");
  const [cPass, setCPass] = useState("");
  const [cRol, setCRol] = useState("owner");

  const [pagoOpen, setPagoOpen] = useState(false);
  const [pNegocioId, setPNegocioId] = useState<number | "">("");
  const [pInicio, setPInicio] = useState("");
  const [pFin, setPFin] = useState("");
  const [pNota, setPNota] = useState("");
  const [pPreview, setPPreview] = useState<Prorrateo | null>(null);

  const [config, setConfig] = useState<AdminConfig | null>(null);
  const [cfgNombre, setCfgNombre] = useState("");
  const [cfgCuota, setCfgCuota] = useState("29990");
  const [cfgExtra, setCfgExtra] = useState("2990");
  const [cfgGracia, setCfgGracia] = useState("5");
  const [cfgDia, setCfgDia] = useState("1");
  const [cfgSaving, setCfgSaving] = useState(false);
  const [calcInicio, setCalcInicio] = useState("");
  const [calcFin, setCalcFin] = useState("");
  const [calcResult, setCalcResult] = useState<Prorrateo | null>(null);
  const [ticketsAdmin, setTicketsAdmin] = useState<TicketAdmin[]>([]);
  const [ticketRespuesta, setTicketRespuesta] = useState("");
  const [resetsAdmin, setResetsAdmin] = useState<ResetPasswordAdmin[]>([]);
  const [resetTempPass, setResetTempPass] = useState<Record<number, string>>({});
  const [resetBusyId, setResetBusyId] = useState<number | null>(null);

  const selected = useMemo(
    () => negocios.find((n) => n.id === selectedId) ?? null,
    [negocios, selectedId],
  );

  const loadAll = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const headers = authHeaders(token);
      const [rRes, nRes, pRes, cRes, tRes, resetRes] = await Promise.all([
        fetch(apiUrl("/api/v1/admin/resumen"), { headers }),
        fetch(apiUrl("/api/v1/admin/negocios"), { headers }),
        fetch(apiUrl("/api/v1/admin/pagos"), { headers }),
        fetch(apiUrl("/api/v1/admin/config"), { headers }),
        fetch(apiUrl("/api/v1/admin/tickets"), { headers }),
        fetch(apiUrl("/api/v1/admin/password-resets"), { headers }),
      ]);
      if (
        !rRes.ok ||
        !nRes.ok ||
        !pRes.ok ||
        !cRes.ok ||
        !tRes.ok ||
        !resetRes.ok
      ) {
        const bad = !rRes.ok
          ? rRes
          : !nRes.ok
            ? nRes
            : !pRes.ok
              ? pRes
              : !cRes.ok
                ? cRes
                : !tRes.ok
                  ? tRes
                  : resetRes;
        const body = await bad.json().catch(() => ({}));
        throw new Error(
          typeof body.detail === "string" ? body.detail : `Error ${bad.status}`,
        );
      }
      setResumen((await rRes.json()) as AdminResumen);
      setNegocios((await nRes.json()) as Negocio[]);
      setPagos((await pRes.json()) as Pago[]);
      setTicketsAdmin((await tRes.json()) as TicketAdmin[]);
      setResetsAdmin((await resetRes.json()) as ResetPasswordAdmin[]);
      const cfg = (await cRes.json()) as AdminConfig;
      setConfig(cfg);
      setCfgNombre(cfg.nombre_plan);
      setCfgCuota(String(cfg.cuota_mensual_clp));
      setCfgExtra(String(cfg.cuota_negocio_extra_clp ?? 2990));
      setCfgGracia(String(cfg.dias_gracia));
      setCfgDia(String(cfg.dia_facturacion));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al cargar admin");
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    void loadAll();
  }, [loadAll]);

  async function loadCuentas(negocioId: number) {
    setError(null);
    try {
      const res = await fetch(
        apiUrl(`/api/v1/admin/negocios/${negocioId}/cuentas`),
        { headers: authHeaders(token) },
      );
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(
          typeof body.detail === "string" ? body.detail : `Error ${res.status}`,
        );
      }
      setCuentas((await res.json()) as Cuenta[]);
    } catch (err) {
      setCuentas([]);
      setError(err instanceof Error ? err.message : "Error al cargar cuentas");
    }
  }

  async function selectNegocio(id: number) {
    setSelectedId(id);
    setTab("negocios");
    await loadCuentas(id);
  }

  async function toggleActivo(negocio: Negocio) {
    const next = !negocio.activo;
    const msg = next
      ? `¿Reactivar el negocio "${negocio.nombre}"?`
      : `¿Suspender el negocio "${negocio.nombre}"? No podrá operar hasta reactivarlo.`;
    if (!window.confirm(msg)) return;
    setError(null);
    try {
      const res = await fetch(
        apiUrl(`/api/v1/admin/negocios/${negocio.id}`),
        {
          method: "PATCH",
          headers: authHeaders(token),
          body: JSON.stringify({ activo: next }),
        },
      );
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(
          typeof body.detail === "string" ? body.detail : `Error ${res.status}`,
        );
      }
      await loadAll();
      if (selectedId === negocio.id) await loadCuentas(negocio.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al actualizar");
    }
  }

  async function onOnboard(e: FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      const password = await hashPasswordClient(obOwnerPass);
      const res = await fetch(apiUrl("/api/v1/admin/negocios/onboard"), {
        method: "POST",
        headers: authHeaders(token),
        body: JSON.stringify({
          nombre: obNombre,
          slug: obSlug,
          comuna: obComuna.trim(),
          crear_cuota: obCrearCuota,
          owner: {
            nombre: obOwnerNombre,
            email: obOwnerEmail,
            password,
          },
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(
          typeof body.detail === "string" ? body.detail : `Error ${res.status}`,
        );
      }
      const data = (await res.json()) as {
        negocio: Negocio;
        owner_email: string;
      };
      setOnboardOpen(false);
      setObNombre("");
      setObSlug("");
      setObComuna("");
      setObOwnerNombre("");
      setObOwnerEmail("");
      setObOwnerPass("");
      await loadAll();
      await selectNegocio(data.negocio.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al crear negocio");
    }
  }

  async function onCrearCuenta(e: FormEvent) {
    e.preventDefault();
    if (selectedId == null) return;
    setError(null);
    try {
      const password = await hashPasswordClient(cPass);
      const res = await fetch(
        apiUrl(`/api/v1/admin/negocios/${selectedId}/cuentas`),
        {
          method: "POST",
          headers: authHeaders(token),
          body: JSON.stringify({
            nombre: cNombre,
            email: cEmail,
            password,
            rol: cRol,
          }),
        },
      );
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(
          typeof body.detail === "string" ? body.detail : `Error ${res.status}`,
        );
      }
      setCuentaOpen(false);
      setCNombre("");
      setCEmail("");
      setCPass("");
      setCRol("owner");
      await loadCuentas(selectedId);
      await loadAll();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al crear cuenta");
    }
  }

  async function onTicketAction(
    ticketId: number,
    estado: "EN_PROCESO" | "RESUELTO" | "RECHAZADO",
  ) {
    setError(null);
    try {
      const res = await fetch(apiUrl(`/api/v1/admin/tickets/${ticketId}`), {
        method: "PATCH",
        headers: authHeaders(token),
        body: JSON.stringify({
          estado,
          respuesta_admin: ticketRespuesta.trim() || undefined,
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(
          typeof body.detail === "string" ? body.detail : `Error ${res.status}`,
        );
      }
      setTicketRespuesta("");
      await loadAll();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al actualizar ticket");
    }
  }

  function genTempPassword(): string {
    const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789";
    let out = "";
    for (let i = 0; i < 10; i++) {
      out += chars[Math.floor(Math.random() * chars.length)];
    }
    return out;
  }

  async function onResetAction(
    resetId: number,
    accion: "RESOLVER" | "RECHAZAR",
  ) {
    setError(null);
    setResetBusyId(resetId);
    try {
      let password: string | undefined;
      if (accion === "RESOLVER") {
        const plain = resetTempPass[resetId]?.trim() || genTempPassword();
        if (plain.length < 6) {
          throw new Error("La clave temporal debe tener al menos 6 caracteres");
        }
        if (
          !window.confirm(
            `¿Asignar clave temporal al usuario?\n\nClave: ${plain}\n\nCópiala y entrégasela al usuario. Deberá cambiarla al entrar.`,
          )
        ) {
          return;
        }
        password = await hashPasswordClient(plain);
        setResetTempPass((prev) => ({ ...prev, [resetId]: plain }));
      } else if (!window.confirm("¿Rechazar esta solicitud de recuperación?")) {
        return;
      }
      const res = await fetch(
        apiUrl(`/api/v1/admin/password-resets/${resetId}`),
        {
          method: "PATCH",
          headers: authHeaders(token),
          body: JSON.stringify({
            accion,
            password,
            nota: ticketRespuesta.trim() || undefined,
          }),
        },
      );
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(
          typeof body.detail === "string" ? body.detail : `Error ${res.status}`,
        );
      }
      setTicketRespuesta("");
      await loadAll();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Error al actualizar reset",
      );
    } finally {
      setResetBusyId(null);
    }
  }

  async function onCrearPago(e: FormEvent) {
    e.preventDefault();
    if (pNegocioId === "") return;
    setError(null);
    try {
      const res = await fetch(apiUrl("/api/v1/admin/pagos"), {
        method: "POST",
        headers: authHeaders(token),
        body: JSON.stringify({
          negocio_id: pNegocioId,
          periodo_inicio: pInicio,
          periodo_fin: pFin,
          estado: "PENDIENTE",
          nota: pNota || null,
          prorratear: true,
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(
          typeof body.detail === "string" ? body.detail : `Error ${res.status}`,
        );
      }
      setPagoOpen(false);
      setPNota("");
      setPPreview(null);
      await loadAll();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al crear pago");
    }
  }

  async function refreshPagoPreview(inicio: string, fin: string) {
    if (!inicio || !fin) {
      setPPreview(null);
      return;
    }
    try {
      const res = await fetch(apiUrl("/api/v1/admin/prorrateo"), {
        method: "POST",
        headers: authHeaders(token),
        body: JSON.stringify({
          periodo_inicio: inicio,
          periodo_fin: fin,
        }),
      });
      if (!res.ok) {
        setPPreview(null);
        return;
      }
      setPPreview((await res.json()) as Prorrateo);
    } catch {
      setPPreview(null);
    }
  }

  async function onSaveConfig(e: FormEvent) {
    e.preventDefault();
    setCfgSaving(true);
    setError(null);
    try {
      const res = await fetch(apiUrl("/api/v1/admin/config"), {
        method: "PATCH",
        headers: authHeaders(token),
        body: JSON.stringify({
          nombre_plan: cfgNombre,
          cuota_mensual_clp: Number(cfgCuota),
          cuota_negocio_extra_clp: Number(cfgExtra),
          dias_gracia: Number(cfgGracia),
          dia_facturacion: Number(cfgDia),
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(
          typeof body.detail === "string" ? body.detail : `Error ${res.status}`,
        );
      }
      const cfg = (await res.json()) as AdminConfig;
      setConfig(cfg);
      await loadAll();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al guardar config");
    } finally {
      setCfgSaving(false);
    }
  }

  async function onCalcularProrrateo(e: FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      const res = await fetch(apiUrl("/api/v1/admin/prorrateo"), {
        method: "POST",
        headers: authHeaders(token),
        body: JSON.stringify({
          periodo_inicio: calcInicio,
          periodo_fin: calcFin,
          cuota_mensual_clp: Number(cfgCuota) || undefined,
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(
          typeof body.detail === "string" ? body.detail : `Error ${res.status}`,
        );
      }
      setCalcResult((await res.json()) as Prorrateo);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al prorratear");
    }
  }

  async function setPagoEstado(pago: Pago, estado: Pago["estado"]) {
    setError(null);
    try {
      const res = await fetch(apiUrl(`/api/v1/admin/pagos/${pago.id}`), {
        method: "PATCH",
        headers: authHeaders(token),
        body: JSON.stringify({ estado }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(
          typeof body.detail === "string" ? body.detail : `Error ${res.status}`,
        );
      }
      await loadAll();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al actualizar pago");
    }
  }

  function suggestSlug(nombre: string) {
    return nombre
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 80);
  }

  /** Alta pública sin cuota aún → pendiente de aprobación. */
  function esPendienteAprobacion(n: Negocio): boolean {
    return !n.activo && n.ultimo_pago_estado == null;
  }

  async function aprobarNegocio(negocio: Negocio) {
    if (
      !window.confirm(
        `¿Aprobar el negocio "${negocio.nombre}"? Se activará y se creará la cuota del mes.`,
      )
    ) {
      return;
    }
    setError(null);
    try {
      const res = await fetch(
        apiUrl(`/api/v1/admin/negocios/${negocio.id}`),
        {
          method: "PATCH",
          headers: authHeaders(token),
          body: JSON.stringify({ activo: true }),
        },
      );
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(
          typeof body.detail === "string" ? body.detail : `Error ${res.status}`,
        );
      }
      await loadAll();
      if (selectedId === negocio.id) await loadCuentas(negocio.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al aprobar");
    }
  }

  const pendientesCount = useMemo(
    () => negocios.filter(esPendienteAprobacion).length,
    [negocios],
  );

  const negociosOrdenados = useMemo(() => {
    return [...negocios].sort((a, b) => {
      const pa = esPendienteAprobacion(a) ? 0 : 1;
      const pb = esPendienteAprobacion(b) ? 0 : 1;
      if (pa !== pb) return pa - pb;
      return a.nombre.localeCompare(b.nombre, "es");
    });
  }, [negocios]);

  return (
    <div className="admin-screen">
      <header className="admin-topbar">
        <div className="admin-brand">
          <LogoMark className="admin-logo" gradientId="admin-mark" />
          <div>
            <strong>ScaleUpp Admin</strong>
            <span>
              {adminNombre} · {adminEmail}
            </span>
          </div>
        </div>
        <button type="button" className="admin-logout" onClick={onLogout}>
          Cerrar sesión
        </button>
      </header>

      <nav className="admin-nav" aria-label="Admin">
        <button
          type="button"
          className={tab === "resumen" ? "active" : undefined}
          onClick={() => setTab("resumen")}
        >
          Resumen
        </button>
        <button
          type="button"
          className={tab === "negocios" ? "active" : undefined}
          onClick={() => setTab("negocios")}
        >
          Negocios
        </button>
        <button
          type="button"
          className={tab === "pagos" ? "active" : undefined}
          onClick={() => setTab("pagos")}
        >
          Pagos
        </button>
        <button
          type="button"
          className={tab === "tickets" ? "active" : undefined}
          onClick={() => setTab("tickets")}
        >
          Tickets
          {((resumen?.tickets_abiertos ?? 0) +
            (resumen?.resets_pendientes ?? 0)) >
          0
            ? ` (${(resumen?.tickets_abiertos ?? 0) + (resumen?.resets_pendientes ?? 0)})`
            : ""}
        </button>
        <button
          type="button"
          className={tab === "admin" ? "active" : undefined}
          onClick={() => setTab("admin")}
        >
          Administración
        </button>
      </nav>

      <main className="admin-main">
        {error && (
          <p className="admin-error" role="alert">
            {error}
          </p>
        )}
        {loading && !resumen && <p className="admin-muted">Cargando…</p>}

        {tab === "resumen" && resumen && (
          <>
            <h1>Panel de plataforma</h1>
            <p className="admin-lead">
              Administra negocios, cuentas y cobros. Solo disponible en web.
            </p>
            <section className="admin-stats">
              <article>
                <p>Negocios activos</p>
                <strong>{resumen.negocios_activos}</strong>
              </article>
              <article>
                <p>Suspendidos</p>
                <strong>{resumen.negocios_suspendidos}</strong>
              </article>
              <article>
                <p>Pagos pendientes</p>
                <strong>{resumen.pagos_pendientes}</strong>
              </article>
              <article>
                <p>Pagos vencidos</p>
                <strong className="danger-text">{resumen.pagos_vencidos}</strong>
              </article>
              <article>
                <p>Monto por cobrar</p>
                <strong>{formatClp(resumen.monto_pendiente_clp)}</strong>
              </article>
              <article>
                <p>Tickets abiertos</p>
                <strong>{resumen.tickets_abiertos ?? 0}</strong>
              </article>
              <article>
                <p>Recaudado este mes</p>
                <strong className="ok-text">
                  {formatClp(resumen.monto_recaudado_mes_clp ?? 0)}
                </strong>
              </article>
              <article>
                <p>Recaudado total</p>
                <strong className="ok-text">
                  {formatClp(resumen.monto_recaudado_total_clp ?? 0)}
                </strong>
              </article>
            </section>

            <section className="admin-card">
              <h2>Evidencia de recaudación por mes</h2>
              <ul className="admin-table">
                {(resumen.recaudacion_por_mes ?? []).map((r) => (
                  <li key={`${r.anio}-${r.mes}`}>
                    <div>
                      <strong>{r.etiqueta}</strong>
                      <span>
                        {r.num_pagos} pago{r.num_pagos === 1 ? "" : "s"}
                      </span>
                    </div>
                    <em className="ok">{formatClp(r.monto_clp)}</em>
                  </li>
                ))}
                {(resumen.recaudacion_por_mes ?? []).length === 0 && (
                  <li className="admin-muted">
                    Aún no hay pagos marcados como PAGADO.
                  </li>
                )}
              </ul>
            </section>

            <section className="admin-card">
              <h2>Atención: vencidos / pendientes</h2>
              <ul className="admin-table">
                {pagos
                  .filter(
                    (p) => p.estado === "VENCIDO" || p.estado === "PENDIENTE",
                  )
                  .slice(0, 8)
                  .map((p) => (
                    <li key={p.id}>
                      <div>
                        <strong>{p.negocio_nombre}</strong>
                        <span>
                          {formatClp(p.monto)} · {p.periodo_inicio} →{" "}
                          {p.periodo_fin}
                        </span>
                      </div>
                      <em className={estadoClass(p.estado)}>{p.estado}</em>
                    </li>
                  ))}
                {pagos.filter(
                  (p) => p.estado === "VENCIDO" || p.estado === "PENDIENTE",
                ).length === 0 && (
                  <li className="admin-muted">Sin alertas de cobro.</li>
                )}
              </ul>
            </section>
          </>
        )}

        {tab === "negocios" && (
          <>
            <div className="admin-head-row">
              <h1>
                Negocios
                {pendientesCount > 0 && (
                  <span className="badge-warn" style={{ marginLeft: "0.5rem" }}>
                    {pendientesCount} pendiente{pendientesCount === 1 ? "" : "s"}
                  </span>
                )}
              </h1>
              <button
                type="button"
                className="admin-primary"
                onClick={() => setOnboardOpen(true)}
              >
                + Crear negocio y cuenta
              </button>
            </div>

            <div className="admin-split">
              <section className="admin-card">
                <ul className="admin-table">
                  {negociosOrdenados.map((n) => (
                    <li key={n.id}>
                      <button
                        type="button"
                        className={`admin-row-btn${selectedId === n.id ? " active" : ""}`}
                        onClick={() => void selectNegocio(n.id)}
                      >
                        <div>
                          <strong>
                            {n.nombre}{" "}
                            {!n.activo &&
                              (esPendienteAprobacion(n) ? (
                                <span className="badge-warn">Pendiente</span>
                              ) : (
                                <span className="badge-danger">Suspendido</span>
                              ))}
                          </strong>
                          <span>
                            {n.slug}
                            {n.comuna ? ` · ${n.comuna}` : ""} ·{" "}
                            {n.num_usuarios} usuarios · pend.{" "}
                            {n.pagos_pendientes}/{n.pagos_vencidos} venc.
                          </span>
                        </div>
                      </button>
                    </li>
                  ))}
                  {negocios.length === 0 && (
                    <li className="admin-muted">Sin negocios.</li>
                  )}
                </ul>
              </section>

              <section className="admin-card">
                {selected ? (
                  <>
                    <h2>{selected.nombre}</h2>
                    <p className="admin-muted">
                      slug: {selected.slug}
                      {selected.comuna ? ` · ${selected.comuna}` : ""} ·{" "}
                      {selected.activo
                        ? "Activo"
                        : esPendienteAprobacion(selected)
                          ? "Pendiente de aprobación"
                          : "Suspendido"}
                    </p>
                    <div className="admin-actions">
                      {selected.activo ? (
                        <button
                          type="button"
                          className="admin-danger"
                          onClick={() => void toggleActivo(selected)}
                        >
                          Suspender cuenta
                        </button>
                      ) : esPendienteAprobacion(selected) ? (
                        <button
                          type="button"
                          className="admin-primary"
                          onClick={() => void aprobarNegocio(selected)}
                        >
                          Aprobar negocio
                        </button>
                      ) : (
                        <button
                          type="button"
                          className="admin-primary"
                          onClick={() => void toggleActivo(selected)}
                        >
                          Reactivar
                        </button>
                      )}
                      {selected.activo && (
                        <button
                          type="button"
                          className="admin-secondary"
                          onClick={() => onEnterNegocio(selected.id)}
                        >
                          Abrir POS (web)
                        </button>
                      )}
                      <button
                        type="button"
                        className="admin-secondary"
                        onClick={() => setCuentaOpen(true)}
                      >
                        + Cuenta usuario
                      </button>
                    </div>

                    <h3>Cuentas del negocio</h3>
                    <ul className="admin-table">
                      {cuentas.map((c) => (
                        <li key={`${c.id}-${c.rol}`}>
                          <div>
                            <strong>{c.nombre}</strong>
                            <span>
                              {c.email} · {c.rol}
                              {!c.membresia_activa ? " · membresía off" : ""}
                              {!c.activo ? " · usuario inactivo" : ""}
                            </span>
                          </div>
                        </li>
                      ))}
                      {cuentas.length === 0 && (
                        <li className="admin-muted">Sin cuentas.</li>
                      )}
                    </ul>
                  </>
                ) : (
                  <p className="admin-muted">
                    Selecciona un negocio para ver cuentas y suspender.
                  </p>
                )}
              </section>
            </div>
          </>
        )}

        {tab === "pagos" && (
          <>
            <div className="admin-head-row">
              <h1>Pagos / cuotas</h1>
              <button
                type="button"
                className="admin-primary"
                onClick={() => {
                  const hoy = new Date();
                  const y = hoy.getFullYear();
                  const m = String(hoy.getMonth() + 1).padStart(2, "0");
                  const last = new Date(y, hoy.getMonth() + 1, 0).getDate();
                  setPInicio(`${y}-${m}-01`);
                  setPFin(`${y}-${m}-${String(last).padStart(2, "0")}`);
                  setPNegocioId(selectedId ?? negocios[0]?.id ?? "");
                  setPagoOpen(true);
                }}
              >
                + Registrar cuota
              </button>
            </div>
            <section className="admin-card">
              <ul className="admin-table">
                {pagos.map((p) => (
                  <li key={p.id} className="admin-pago-row">
                    <div>
                      <strong>
                        {p.negocio_nombre}{" "}
                        {!p.negocio_activo && (
                          <span className="badge-danger">Suspendido</span>
                        )}
                      </strong>
                      <span>
                        {formatClp(p.monto)} · {p.periodo_inicio} →{" "}
                        {p.periodo_fin}
                        {p.dias_usados != null && p.dias_base != null
                          ? ` · ${p.dias_usados}/${p.dias_base} días`
                          : ""}
                        {p.nota ? ` · ${p.nota}` : ""}
                      </span>
                    </div>
                    <div className="admin-pago-actions">
                      <em className={estadoClass(p.estado)}>{p.estado}</em>
                      {p.estado !== "PAGADO" && (
                        <button
                          type="button"
                          className="admin-mini ok"
                          onClick={() => void setPagoEstado(p, "PAGADO")}
                        >
                          Marcar pagado
                        </button>
                      )}
                      {p.estado === "VENCIDO" && p.negocio_activo && (
                        <button
                          type="button"
                          className="admin-mini danger"
                          onClick={() => {
                            const n = negocios.find((x) => x.id === p.negocio_id);
                            if (n) void toggleActivo(n);
                          }}
                        >
                          Suspender
                        </button>
                      )}
                      {p.estado === "PAGADO" && !p.negocio_activo && (
                        <button
                          type="button"
                          className="admin-mini ok"
                          onClick={() => {
                            const n = negocios.find((x) => x.id === p.negocio_id);
                            if (n) void toggleActivo(n);
                          }}
                        >
                          Reactivar
                        </button>
                      )}
                    </div>
                  </li>
                ))}
                {pagos.length === 0 && (
                  <li className="admin-muted">Sin pagos registrados.</li>
                )}
              </ul>
            </section>
          </>
        )}

        {tab === "tickets" && (
          <>
            <h1>Tickets de soporte</h1>
            <p className="admin-lead">
              Desuscripciones y solicitudes de negocio extra (+
              {formatClp(config?.cuota_negocio_extra_clp ?? 2990)}/mes).
            </p>
            <label className="admin-card" style={{ display: "block" }}>
              Respuesta (opcional, se aplica a la siguiente acción)
              <input
                value={ticketRespuesta}
                onChange={(e) => setTicketRespuesta(e.target.value)}
                placeholder="Mensaje para el negocio…"
                style={{ width: "100%", marginTop: "0.4rem" }}
              />
            </label>
            <section className="admin-card">
              <ul className="admin-table">
                {ticketsAdmin.map((t) => (
                  <li key={t.id}>
                    <div>
                      <strong>
                        {t.tipo === "NUEVO_NEGOCIO"
                          ? "Nuevo negocio"
                          : "Desuscripción"}{" "}
                        · {t.negocio_nombre}
                      </strong>
                      <span>
                        {t.usuario_nombre} ({t.usuario_email}) ·{" "}
                        {new Date(t.creado_en).toLocaleString("es-CL")}
                        {t.nombre_negocio_solicitado
                          ? ` · «${t.nombre_negocio_solicitado}»`
                          : ""}
                        {t.comuna_negocio_solicitado
                          ? ` · ${t.comuna_negocio_solicitado}`
                          : ""}
                      </span>
                      {t.mensaje && <span>Msg: {t.mensaje}</span>}
                      {t.respuesta_admin && (
                        <span>Respuesta: {t.respuesta_admin}</span>
                      )}
                    </div>
                    <div className="admin-actions">
                      <em className={estadoClass(t.estado)}>{t.estado}</em>
                      {(t.estado === "ABIERTO" ||
                        t.estado === "EN_PROCESO") && (
                        <>
                          {t.estado === "ABIERTO" && (
                            <button
                              type="button"
                              className="admin-mini"
                              onClick={() =>
                                void onTicketAction(t.id, "EN_PROCESO")
                              }
                            >
                              En proceso
                            </button>
                          )}
                          <button
                            type="button"
                            className="admin-mini ok"
                            onClick={() =>
                              void onTicketAction(t.id, "RESUELTO")
                            }
                          >
                            Resolver
                          </button>
                          <button
                            type="button"
                            className="admin-mini danger"
                            onClick={() =>
                              void onTicketAction(t.id, "RECHAZADO")
                            }
                          >
                            Rechazar
                          </button>
                        </>
                      )}
                    </div>
                  </li>
                ))}
                {ticketsAdmin.length === 0 && (
                  <li className="admin-muted">Sin tickets.</li>
                )}
              </ul>
            </section>

            <h2 style={{ marginTop: "1.5rem" }}>
              Recuperación de contraseña
              {(resumen?.resets_pendientes ?? 0) > 0 && (
                <span className="badge-warn" style={{ marginLeft: "0.5rem" }}>
                  {resumen?.resets_pendientes} pendiente
                  {(resumen?.resets_pendientes ?? 0) === 1 ? "" : "s"}
                </span>
              )}
            </h2>
            <p className="admin-lead">
              Asigna una clave temporal y entrégasela al usuario (WhatsApp/teléfono).
              Al entrar deberá cambiarla.
            </p>
            <section className="admin-card">
              <ul className="admin-table">
                {resetsAdmin.map((r) => (
                  <li key={r.id}>
                    <div>
                      <strong>
                        {r.usuario_nombre}{" "}
                        {r.estado === "PENDIENTE" && (
                          <span className="badge-warn">Pendiente</span>
                        )}
                      </strong>
                      <span>
                        {r.email} ·{" "}
                        {new Date(r.creado_en).toLocaleString("es-CL")}
                      </span>
                      {r.nota_admin && <span>Nota: {r.nota_admin}</span>}
                    </div>
                    <div className="admin-actions">
                      <em className={estadoClass(r.estado)}>{r.estado}</em>
                      {r.estado === "PENDIENTE" && (
                        <>
                          <input
                            type="text"
                            placeholder="Clave temporal (opcional)"
                            value={resetTempPass[r.id] ?? ""}
                            onChange={(e) =>
                              setResetTempPass((prev) => ({
                                ...prev,
                                [r.id]: e.target.value,
                              }))
                            }
                            style={{
                              minWidth: "10rem",
                              padding: "0.35rem 0.5rem",
                              borderRadius: "0.4rem",
                              border: "1px solid #e5e7eb",
                            }}
                          />
                          <button
                            type="button"
                            className="admin-mini"
                            disabled={resetBusyId === r.id}
                            onClick={() =>
                              setResetTempPass((prev) => ({
                                ...prev,
                                [r.id]: genTempPassword(),
                              }))
                            }
                          >
                            Generar
                          </button>
                          <button
                            type="button"
                            className="admin-mini ok"
                            disabled={resetBusyId === r.id}
                            onClick={() => void onResetAction(r.id, "RESOLVER")}
                          >
                            Asignar clave
                          </button>
                          <button
                            type="button"
                            className="admin-mini danger"
                            disabled={resetBusyId === r.id}
                            onClick={() => void onResetAction(r.id, "RECHAZAR")}
                          >
                            Rechazar
                          </button>
                        </>
                      )}
                    </div>
                  </li>
                ))}
                {resetsAdmin.length === 0 && (
                  <li className="admin-muted">Sin solicitudes de reset.</li>
                )}
              </ul>
            </section>
          </>
        )}

        {tab === "admin" && (
          <>
            <h1>Administración</h1>
            <p className="admin-lead">
              Define la cuota mensual y parámetros de cobro. Los montos se
              calculan proporcionales a los días usados:{" "}
              <code>cuota × días / días_del_mes</code>.
            </p>

            <form className="admin-card" onSubmit={(e) => void onSaveConfig(e)}>
              <h2>Valores del plan</h2>
              <div className="admin-form-grid">
                <label>
                  Nombre del plan
                  <input
                    value={cfgNombre}
                    onChange={(e) => setCfgNombre(e.target.value)}
                    required
                  />
                </label>
                <label>
                  Cuota mensual (CLP)
                  <input
                    type="number"
                    min={0}
                    value={cfgCuota}
                    onChange={(e) => setCfgCuota(e.target.value)}
                    required
                  />
                </label>
                <label>
                  Negocio extra / mes (CLP)
                  <input
                    type="number"
                    min={0}
                    value={cfgExtra}
                    onChange={(e) => setCfgExtra(e.target.value)}
                    required
                  />
                </label>
                <label>
                  Días de gracia
                  <input
                    type="number"
                    min={0}
                    max={31}
                    value={cfgGracia}
                    onChange={(e) => setCfgGracia(e.target.value)}
                    required
                  />
                </label>
                <label>
                  Día de facturación
                  <input
                    type="number"
                    min={1}
                    max={28}
                    value={cfgDia}
                    onChange={(e) => setCfgDia(e.target.value)}
                    required
                  />
                </label>
              </div>
              {config && (
                <p className="admin-muted" style={{ marginTop: "0.75rem" }}>
                  Cuota diaria aprox. (base 30):{" "}
                  {formatClp(config.cuota_diaria_aprox)} · Actualizado{" "}
                  {new Date(config.actualizado_en).toLocaleString("es-CL")}
                </p>
              )}
              <button
                type="submit"
                className="admin-primary"
                style={{ marginTop: "0.9rem" }}
                disabled={cfgSaving}
              >
                {cfgSaving ? "Guardando…" : "Guardar valores"}
              </button>
            </form>

            <form
              className="admin-card"
              onSubmit={(e) => void onCalcularProrrateo(e)}
            >
              <h2>Calculadora de prorrateo</h2>
              <p className="admin-muted">
                Prueba cuánto cobrarías por un tramo de días con la cuota
                actual.
              </p>
              <div className="admin-form-grid">
                <label>
                  Desde
                  <input
                    type="date"
                    value={calcInicio}
                    onChange={(e) => setCalcInicio(e.target.value)}
                    required
                  />
                </label>
                <label>
                  Hasta
                  <input
                    type="date"
                    value={calcFin}
                    onChange={(e) => setCalcFin(e.target.value)}
                    required
                  />
                </label>
              </div>
              <button
                type="submit"
                className="admin-secondary"
                style={{ marginTop: "0.85rem" }}
              >
                Calcular
              </button>
              {calcResult && (
                <div className="admin-prorrateo-box">
                  <p>
                    <strong>{formatClp(calcResult.monto_prorrateado)}</strong>
                  </p>
                  <p>
                    {calcResult.dias_usados} días usados / {calcResult.dias_base}{" "}
                    días base · diaria {calcResult.cuota_diaria.toLocaleString("es-CL")}
                  </p>
                  <p className="admin-muted">{calcResult.formula}</p>
                </div>
              )}
            </form>
          </>
        )}
      </main>

      {onboardOpen && (
        <div className="admin-modal-backdrop">
          <form className="admin-modal" onSubmit={(e) => void onOnboard(e)}>
            <h2>Crear negocio + cuenta owner</h2>
            <label>
              Nombre del negocio
              <input
                value={obNombre}
                onChange={(e) => {
                  setObNombre(e.target.value);
                  if (!obSlug || obSlug === suggestSlug(obNombre)) {
                    setObSlug(suggestSlug(e.target.value));
                  }
                }}
                required
              />
            </label>
            <label>
              Slug (URL)
              <input
                value={obSlug}
                onChange={(e) => setObSlug(e.target.value.toLowerCase())}
                pattern="^[a-z0-9]+(?:-[a-z0-9]+)*$"
                required
              />
            </label>
            <label>
              Comuna
              <input
                value={obComuna}
                onChange={(e) => setObComuna(e.target.value)}
                placeholder="Ej. Providencia, Maipú…"
                minLength={2}
                required
              />
            </label>
            <label>
              Cuota inicial prorrateada
              <span className="admin-check-row">
                <input
                  type="checkbox"
                  checked={obCrearCuota}
                  onChange={(e) => setObCrearCuota(e.target.checked)}
                />
                Crear cuota desde hoy a fin de mes (proporcional a días)
              </span>
            </label>
            <hr />
            <label>
              Nombre owner
              <input
                value={obOwnerNombre}
                onChange={(e) => setObOwnerNombre(e.target.value)}
                required
              />
            </label>
            <label>
              Email owner
              <input
                type="email"
                value={obOwnerEmail}
                onChange={(e) => setObOwnerEmail(e.target.value)}
                required
              />
            </label>
            <label>
              Password inicial
              <input
                type="password"
                value={obOwnerPass}
                onChange={(e) => setObOwnerPass(e.target.value)}
                minLength={6}
                required
              />
            </label>
            <div className="admin-modal-actions">
              <button
                type="button"
                className="admin-secondary"
                onClick={() => setOnboardOpen(false)}
              >
                Cancelar
              </button>
              <button type="submit" className="admin-primary">
                Crear
              </button>
            </div>
          </form>
        </div>
      )}

      {cuentaOpen && selected && (
        <div className="admin-modal-backdrop">
          <form className="admin-modal" onSubmit={(e) => void onCrearCuenta(e)}>
            <h2>Nueva cuenta · {selected.nombre}</h2>
            <label>
              Nombre
              <input
                value={cNombre}
                onChange={(e) => setCNombre(e.target.value)}
                required
              />
            </label>
            <label>
              Email
              <input
                type="email"
                value={cEmail}
                onChange={(e) => setCEmail(e.target.value)}
                required
              />
            </label>
            <label>
              Password
              <input
                type="password"
                value={cPass}
                onChange={(e) => setCPass(e.target.value)}
                minLength={6}
                required
              />
            </label>
            <label>
              Rol
              <select value={cRol} onChange={(e) => setCRol(e.target.value)}>
                <option value="owner">owner</option>
                <option value="cajero">cajero</option>
              </select>
            </label>
            <div className="admin-modal-actions">
              <button
                type="button"
                className="admin-secondary"
                onClick={() => setCuentaOpen(false)}
              >
                Cancelar
              </button>
              <button type="submit" className="admin-primary">
                Crear cuenta
              </button>
            </div>
          </form>
        </div>
      )}

      {pagoOpen && (
        <div className="admin-modal-backdrop">
          <form className="admin-modal" onSubmit={(e) => void onCrearPago(e)}>
            <h2>Registrar cuota</h2>
            <label>
              Negocio
              <select
                value={pNegocioId}
                onChange={(e) => setPNegocioId(Number(e.target.value))}
                required
              >
                <option value="">Selecciona…</option>
                {negocios.map((n) => (
                  <option key={n.id} value={n.id}>
                    {n.nombre}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Monto
              <input
                value={
                  pPreview
                    ? `${pPreview.monto_prorrateado.toLocaleString("es-CL")} CLP (prorrateado)`
                    : "Se calcula al elegir fechas"
                }
                readOnly
              />
            </label>
            <label>
              Periodo inicio
              <input
                type="date"
                value={pInicio}
                onChange={(e) => {
                  setPInicio(e.target.value);
                  void refreshPagoPreview(e.target.value, pFin);
                }}
                required
              />
            </label>
            <label>
              Periodo fin
              <input
                type="date"
                value={pFin}
                onChange={(e) => {
                  setPFin(e.target.value);
                  void refreshPagoPreview(pInicio, e.target.value);
                }}
                required
              />
            </label>
            {pPreview && (
              <p className="admin-muted">{pPreview.formula}</p>
            )}
            <label>
              Nota
              <input
                value={pNota}
                onChange={(e) => setPNota(e.target.value)}
                placeholder="Opcional"
              />
            </label>
            <div className="admin-modal-actions">
              <button
                type="button"
                className="admin-secondary"
                onClick={() => setPagoOpen(false)}
              >
                Cancelar
              </button>
              <button type="submit" className="admin-primary">
                Guardar
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
