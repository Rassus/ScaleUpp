import { FormEvent, useEffect, useMemo, useState } from "react";
import DashTopbar from "../components/DashTopbar";
import "./DashboardPage.css";
import "./TicketsPage.css";

export type TicketItem = {
  id: number;
  negocio_id: number;
  negocio_nombre: string;
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

type TicketsPageProps = {
  tickets: TicketItem[];
  loading: boolean;
  saving: boolean;
  error: string | null;
  cuotaExtra: number;
  onOpenMenu: () => void;
  onRefresh: () => void | Promise<void>;
  onCreate: (payload: {
    tipo: "DESUSCRIPCION" | "NUEVO_NEGOCIO";
    mensaje?: string;
    nombre_negocio?: string;
    slug_negocio?: string;
    comuna?: string;
  }) => void | Promise<void>;
};

function suggestSlug(nombre: string) {
  return nombre
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 80);
}

function formatClp(n: number) {
  return `$${n.toLocaleString("es-CL")}`;
}

function estadoLabel(e: string) {
  if (e === "ABIERTO") return "Abierto";
  if (e === "EN_PROCESO") return "En proceso";
  if (e === "RESUELTO") return "Resuelto";
  if (e === "RECHAZADO") return "Rechazado";
  return e;
}

export default function TicketsPage({
  tickets,
  loading,
  saving,
  error,
  cuotaExtra,
  onOpenMenu,
  onRefresh,
  onCreate,
}: TicketsPageProps) {
  const [modo, setModo] = useState<"DESUSCRIPCION" | "NUEVO_NEGOCIO" | null>(
    null,
  );
  const [mensaje, setMensaje] = useState("");
  const [nombreNegocio, setNombreNegocio] = useState("");
  const [slug, setSlug] = useState("");
  const [comuna, setComuna] = useState("");

  useEffect(() => {
    void onRefresh();
  }, [onRefresh]);

  const abiertos = useMemo(
    () =>
      tickets.filter(
        (t) => t.estado === "ABIERTO" || t.estado === "EN_PROCESO",
      ),
    [tickets],
  );

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!modo) return;
    if (modo === "NUEVO_NEGOCIO") {
      await onCreate({
        tipo: modo,
        mensaje: mensaje.trim() || undefined,
        nombre_negocio: nombreNegocio.trim(),
        slug_negocio: slug.trim() || suggestSlug(nombreNegocio),
        comuna: comuna.trim(),
      });
    } else {
      await onCreate({
        tipo: modo,
        mensaje: mensaje.trim() || undefined,
      });
    }
    setModo(null);
    setMensaje("");
    setNombreNegocio("");
    setSlug("");
    setComuna("");
  }

  return (
    <div className="tickets-screen dash-screen">
      <DashTopbar onOpenMenu={onOpenMenu} gradientId="tickets-mark" />

      <main className="tickets-main">
        <h1 className="tickets-title">Tickets</h1>
        <p className="tickets-lead">
          Solicita desuscripción del plan o agrega otro negocio (+
          {formatClp(cuotaExtra)}/mes).
        </p>

        {error && (
          <p className="tickets-error" role="alert">
            {error}
          </p>
        )}

        <section className="tickets-card">
          <h2>Nueva solicitud</h2>
          <div className="tickets-actions">
            <button
              type="button"
              className={modo === "NUEVO_NEGOCIO" ? "active" : undefined}
              onClick={() => setModo("NUEVO_NEGOCIO")}
            >
              Sumar nuevo negocio
            </button>
            <button
              type="button"
              className={modo === "DESUSCRIPCION" ? "active danger" : "danger"}
              onClick={() => setModo("DESUSCRIPCION")}
            >
              Desuscribir plan
            </button>
          </div>

          {modo && (
            <form className="tickets-form" onSubmit={handleSubmit}>
              {modo === "NUEVO_NEGOCIO" && (
                <>
                  <p className="tickets-hint">
                    Al aprobarse, podrás administrar el nuevo negocio por
                    separado. Se suma {formatClp(cuotaExtra)} al pago mensual.
                  </p>
                  <label>
                    Nombre del negocio
                    <input
                      value={nombreNegocio}
                      onChange={(e) => {
                        setNombreNegocio(e.target.value);
                        setSlug(suggestSlug(e.target.value));
                      }}
                      required
                      minLength={2}
                      placeholder="Ej. Minimarket Centro"
                    />
                  </label>
                  <label>
                    Slug (identificador)
                    <input
                      value={slug}
                      onChange={(e) => setSlug(e.target.value)}
                      pattern="^[a-z0-9]+(?:-[a-z0-9]+)*$"
                      required
                    />
                  </label>
                  <label>
                    Comuna
                    <input
                      value={comuna}
                      onChange={(e) => setComuna(e.target.value)}
                      required
                      minLength={2}
                      placeholder="Ej. Providencia, Maipú…"
                    />
                  </label>
                </>
              )}
              {modo === "DESUSCRIPCION" && (
                <p className="tickets-hint">
                  Un administrador revisará la solicitud y podrá suspender el
                  plan de este negocio.
                </p>
              )}
              <label>
                Mensaje (opcional)
                <textarea
                  value={mensaje}
                  onChange={(e) => setMensaje(e.target.value)}
                  rows={3}
                  maxLength={1000}
                  placeholder="Detalle o motivo…"
                />
              </label>
              <div className="tickets-form-row">
                <button type="submit" disabled={saving}>
                  {saving ? "Enviando…" : "Enviar ticket"}
                </button>
                <button
                  type="button"
                  className="ghost"
                  onClick={() => setModo(null)}
                >
                  Cancelar
                </button>
              </div>
            </form>
          )}
        </section>

        <section className="tickets-card">
          <div className="tickets-head-row">
            <h2>Historial</h2>
            <button type="button" className="ghost" onClick={() => void onRefresh()}>
              Actualizar
            </button>
          </div>
          {loading && <p className="tickets-muted">Cargando…</p>}
          {!loading && tickets.length === 0 && (
            <p className="tickets-muted">Aún no hay tickets.</p>
          )}
          <ul className="tickets-list">
            {tickets.map((t) => (
              <li key={t.id}>
                <div>
                  <strong>
                    {t.tipo === "NUEVO_NEGOCIO"
                      ? "Nuevo negocio"
                      : "Desuscripción"}
                  </strong>
                  <span>
                    {new Date(t.creado_en).toLocaleString("es-CL")}
                    {t.nombre_negocio_solicitado
                      ? ` · ${t.nombre_negocio_solicitado}`
                      : ""}
                    {t.comuna_negocio_solicitado
                      ? ` · ${t.comuna_negocio_solicitado}`
                      : ""}
                  </span>
                  {t.respuesta_admin && (
                    <em>Respuesta: {t.respuesta_admin}</em>
                  )}
                </div>
                <span className={`tickets-badge ${t.estado.toLowerCase()}`}>
                  {estadoLabel(t.estado)}
                </span>
              </li>
            ))}
          </ul>
          {abiertos.length > 0 && (
            <p className="tickets-muted">
              {abiertos.length} solicitud(es) en curso.
            </p>
          )}
        </section>
      </main>
    </div>
  );
}
