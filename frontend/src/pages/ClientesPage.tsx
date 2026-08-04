import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import DashTopbar from "../components/DashTopbar";
import { useHardwareBack } from "../hooks/useHardwareBack";
import { formatClp as formatMoney } from "../money";
import "./DashboardPage.css";
import "./ClientesPage.css";

export type ClienteItem = {
  id: number;
  nombre: string;
  telefono: string | null;
  rut: string | null;
  limite_credito: number;
  porcentaje_recargo: number | string;
  plazo_dias: number;
  activo: boolean;
  deuda_actual: number;
  disponible: number;
};

export type ClienteCargo = {
  id: number;
  venta_id: number | null;
  monto: number;
  saldo: number;
  fecha_vencimiento: string | null;
  descripcion: string | null;
  creado_en: string;
  vencido: boolean;
};

export type ClienteDeuda = {
  cliente_id: number;
  cliente_nombre: string;
  limite_credito: number;
  deuda_actual: number;
  disponible: number;
  porcentaje_recargo: number | string;
  plazo_dias: number;
  cargos_abiertos: ClienteCargo[];
};

export type ClienteFormValues = {
  nombre: string;
  telefono: string;
  rut: string;
  limite_credito: string;
  porcentaje_recargo: string;
  plazo_dias: string;
};

type ClientesPageProps = {
  clientes: ClienteItem[];
  deuda: ClienteDeuda | null;
  canWrite: boolean;
  loading: boolean;
  saving: boolean;
  error: string | null;
  onOpenMenu: () => void;
  onRefresh: () => void | Promise<void>;
  onSelectCliente: (id: number | null) => void | Promise<void>;
  onCreate: (values: ClienteFormValues) => Promise<void> | void;
  onUpdate: (id: number, values: ClienteFormValues & { activo?: boolean }) => Promise<void> | void;
  onDelete: (id: number) => Promise<void> | void;
  onCobrar: (data: {
    cliente_id: number;
    monto: number;
    medio_pago: string;
  }) => Promise<void> | void;
};

function emptyForm(): ClienteFormValues {
  return {
    nombre: "",
    telefono: "",
    rut: "",
    limite_credito: "50000",
    porcentaje_recargo: "10",
    plazo_dias: "30",
  };
}

export default function ClientesPage({
  clientes,
  deuda,
  canWrite,
  loading,
  saving,
  error,
  onOpenMenu,
  onRefresh,
  onSelectCliente,
  onCreate,
  onUpdate,
  onDelete,
  onCobrar,
}: ClientesPageProps) {
  const [q, setQ] = useState("");
  const [formOpen, setFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState<ClienteFormValues>(emptyForm);
  const [cobroMonto, setCobroMonto] = useState("");
  const [cobroMedio, setCobroMedio] = useState("EFECTIVO");

  useHardwareBack(
    useCallback(() => {
      if (formOpen) {
        setFormOpen(false);
        setEditingId(null);
        return true;
      }
      return false;
    }, [formOpen]),
  );

  useEffect(() => {
    void onRefresh();
  }, [onRefresh]);

  const filtrados = useMemo(() => {
    const term = q.trim().toLowerCase();
    if (!term) return clientes;
    return clientes.filter(
      (c) =>
        c.nombre.toLowerCase().includes(term) ||
        (c.telefono ?? "").toLowerCase().includes(term) ||
        (c.rut ?? "").toLowerCase().includes(term),
    );
  }, [clientes, q]);

  function openCreate() {
    setEditingId(null);
    setForm(emptyForm());
    setFormOpen(true);
  }

  function openEdit(c: ClienteItem) {
    setEditingId(c.id);
    setForm({
      nombre: c.nombre,
      telefono: c.telefono ?? "",
      rut: c.rut ?? "",
      limite_credito: String(c.limite_credito),
      porcentaje_recargo: String(c.porcentaje_recargo),
      plazo_dias: String(c.plazo_dias),
    });
    setFormOpen(true);
  }

  async function submitForm(e: FormEvent) {
    e.preventDefault();
    if (editingId != null) {
      await onUpdate(editingId, form);
    } else {
      await onCreate(form);
    }
    setFormOpen(false);
    setEditingId(null);
    setForm(emptyForm());
  }

  async function submitCobro(e: FormEvent) {
    e.preventDefault();
    if (!deuda) return;
    const monto = Math.round(Number(cobroMonto));
    if (!Number.isFinite(monto) || monto <= 0) return;
    await onCobrar({
      cliente_id: deuda.cliente_id,
      monto,
      medio_pago: cobroMedio,
    });
    setCobroMonto("");
  }

  return (
    <div className="cli-screen dash-screen">
      <DashTopbar onOpenMenu={onOpenMenu} gradientId="cli-mark" />

      <main className="cli-main">
        <div className="cli-head">
          <div>
            <h1 className="cli-title">Clientes / Crédito</h1>
            <p className="cli-lead">
              Límites, recargo y cobros de fiado. El fiado no mueve el efectivo
              de caja hasta que pagan.
            </p>
          </div>
          {canWrite && (
            <button type="button" className="cli-btn-primary" onClick={openCreate}>
              + Cliente
            </button>
          )}
        </div>

        {error && (
          <p className="cli-error" role="alert">
            {error}
          </p>
        )}

        <label className="cli-search">
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Buscar cliente…"
            aria-label="Buscar cliente"
          />
        </label>

        {loading && <p className="cli-muted">Cargando…</p>}

        <ul className="cli-list">
          {filtrados.map((c) => {
            const selected = deuda?.cliente_id === c.id;
            return (
              <li key={c.id}>
                <button
                  type="button"
                  className={`cli-item${selected ? " is-selected" : ""}`}
                  onClick={() => void onSelectCliente(selected ? null : c.id)}
                >
                  <span className="cli-item-main">
                    <strong>{c.nombre}</strong>
                    <em>
                      Deuda {formatMoney(c.deuda_actual)} · Disp.{" "}
                      {Number(c.limite_credito) <= 0
                        ? "Sin límite"
                        : formatMoney(c.disponible)}
                    </em>
                    <em>
                      Límite{" "}
                      {Number(c.limite_credito) <= 0
                        ? "Sin límite"
                        : formatMoney(c.limite_credito)}{" "}
                      · Recargo {Number(c.porcentaje_recargo)}% · {c.plazo_dias}{" "}
                      días
                    </em>
                  </span>
                  {canWrite && (
                    <span className="cli-item-actions">
                      <span
                        className="cli-edit"
                        role="button"
                        tabIndex={0}
                        onClick={(e) => {
                          e.stopPropagation();
                          openEdit(c);
                        }}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            e.stopPropagation();
                            openEdit(c);
                          }
                        }}
                      >
                        Editar
                      </span>
                      <span
                        className="cli-delete"
                        role="button"
                        tabIndex={0}
                        onClick={(e) => {
                          e.stopPropagation();
                          if (
                            window.confirm(
                              `¿Eliminar a ${c.nombre}? Solo si no tiene deuda.`,
                            )
                          ) {
                            void onDelete(c.id);
                          }
                        }}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            e.stopPropagation();
                            if (
                              window.confirm(
                                `¿Eliminar a ${c.nombre}? Solo si no tiene deuda.`,
                              )
                            ) {
                              void onDelete(c.id);
                            }
                          }
                        }}
                      >
                        Eliminar
                      </span>
                    </span>
                  )}
                </button>
              </li>
            );
          })}
          {!loading && filtrados.length === 0 && (
            <li className="cli-empty">Sin clientes aún.</li>
          )}
        </ul>

        {deuda && (
          <section className="cli-deuda" aria-label="Deuda del cliente">
            <div className="cli-deuda-head">
              <h2>{deuda.cliente_nombre}</h2>
              <button
                type="button"
                className="cli-link"
                onClick={() => void onSelectCliente(null)}
              >
                Cerrar
              </button>
            </div>
            <p className="cli-deuda-sum">
              Debe <strong>{formatMoney(deuda.deuda_actual)}</strong> · Cupo{" "}
              {Number(deuda.limite_credito) <= 0
                ? "Sin límite"
                : formatMoney(deuda.disponible)}
            </p>

            {canWrite && deuda.deuda_actual > 0 && (
              <form className="cli-cobro" onSubmit={(e) => void submitCobro(e)}>
                <label>
                  Cobrar
                  <input
                    type="number"
                    min={1}
                    max={deuda.deuda_actual}
                    value={cobroMonto}
                    onChange={(e) => setCobroMonto(e.target.value)}
                    placeholder={String(deuda.deuda_actual)}
                    required
                  />
                </label>
                <label>
                  Medio
                  <select
                    value={cobroMedio}
                    onChange={(e) => setCobroMedio(e.target.value)}
                  >
                    <option value="EFECTIVO">Efectivo</option>
                    <option value="TARJETA">Tarjeta</option>
                    <option value="TRANSFERENCIA">Transferencia</option>
                  </select>
                </label>
                <button type="submit" disabled={saving}>
                  {saving ? "Guardando…" : "Registrar cobro"}
                </button>
              </form>
            )}

            <ul className="cli-cargos">
              {deuda.cargos_abiertos.map((c) => (
                <li key={c.id}>
                  <span>
                    {c.descripcion ?? `Cargo #${c.id}`}
                    {c.vencido ? " · Vencido" : ""}
                  </span>
                  <strong>{formatMoney(c.saldo)}</strong>
                  <em>
                    Vence{" "}
                    {c.fecha_vencimiento
                      ? new Date(`${c.fecha_vencimiento}T12:00:00`).toLocaleDateString(
                          "es-CL",
                        )
                      : "—"}
                  </em>
                </li>
              ))}
              {deuda.cargos_abiertos.length === 0 && (
                <li className="cli-empty">Sin cargos pendientes.</li>
              )}
            </ul>
          </section>
        )}
      </main>

      {formOpen && (
        <div
          className="cli-backdrop"
          role="presentation"
          onClick={() => setFormOpen(false)}
        >
          <div
            className="cli-modal"
            role="dialog"
            aria-modal="true"
            onClick={(e) => e.stopPropagation()}
          >
            <h2>{editingId != null ? "Editar cliente" : "Nuevo cliente"}</h2>
            <form onSubmit={(e) => void submitForm(e)}>
              <label>
                Nombre
                <input
                  value={form.nombre}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, nombre: e.target.value }))
                  }
                  required
                  minLength={1}
                />
              </label>
              <label>
                Teléfono <span className="cli-optional">(opcional)</span>
                <input
                  value={form.telefono}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, telefono: e.target.value }))
                  }
                  type="tel"
                  inputMode="tel"
                  autoComplete="tel"
                />
              </label>
              <label>
                RUT <span className="cli-optional">(opcional)</span>
                <input
                  value={form.rut}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, rut: e.target.value }))
                  }
                />
              </label>
              <label>
                Límite de crédito (CLP)
                <input
                  type="number"
                  min={0}
                  value={form.limite_credito}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, limite_credito: e.target.value }))
                  }
                  required
                />
                <em className="cli-field-hint">0 = sin límite de crédito</em>
              </label>
              <label>
                % cobro sobre precio
                <input
                  type="number"
                  min={0}
                  max={100}
                  step={0.01}
                  value={form.porcentaje_recargo}
                  onChange={(e) =>
                    setForm((f) => ({
                      ...f,
                      porcentaje_recargo: e.target.value,
                    }))
                  }
                  required
                />
              </label>
              <label>
                Plazo (días)
                <input
                  type="number"
                  min={0}
                  value={form.plazo_dias}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, plazo_dias: e.target.value }))
                  }
                  required
                />
              </label>
              <div className="cli-modal-actions">
                <button
                  type="button"
                  className="cli-btn-ghost"
                  onClick={() => setFormOpen(false)}
                >
                  Cancelar
                </button>
                <button type="submit" className="cli-btn-primary" disabled={saving}>
                  {saving ? "Guardando…" : "Guardar"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
