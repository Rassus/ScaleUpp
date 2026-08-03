import { FormEvent, useEffect, useState } from "react";
import DashTopbar from "../components/DashTopbar";
import "./DashboardPage.css";
import "./EquipoPage.css";

export type EquipoMiembro = {
  id: number;
  email: string;
  nombre: string;
  activo: boolean;
  rol: string;
  membresia_activa: boolean;
};

type EquipoPageProps = {
  miembros: EquipoMiembro[];
  loading: boolean;
  saving: boolean;
  error: string | null;
  onOpenMenu: () => void;
  onRefresh: () => void | Promise<void>;
  onCrearCajero: (data: {
    email: string;
    nombre: string;
    password: string;
  }) => Promise<void>;
};

export default function EquipoPage({
  miembros,
  loading,
  saving,
  error,
  onOpenMenu,
  onRefresh,
  onCrearCajero,
}: EquipoPageProps) {
  const [nombre, setNombre] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  useEffect(() => {
    void onRefresh();
  }, [onRefresh]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    await onCrearCajero({
      email: email.trim(),
      nombre: nombre.trim(),
      password,
    });
    setNombre("");
    setEmail("");
    setPassword("");
  }

  return (
    <div className="equipo-screen dash-screen">
      <DashTopbar onOpenMenu={onOpenMenu} gradientId="equipo-mark" />

      <main className="equipo-main">
        <h1 className="equipo-title">Equipo</h1>
        <p className="equipo-lead">
          Crea cuentas de cajero para tu negocio. Ellos podrán vender y operar
          caja con su propio acceso.
        </p>

        {error && (
          <p className="equipo-error" role="alert">
            {error}
          </p>
        )}

        <section className="equipo-card">
          <h2>Nuevo cajero</h2>
          <form className="equipo-form" onSubmit={(e) => void handleSubmit(e)}>
            <label>
              Nombre
              <input
                value={nombre}
                onChange={(e) => setNombre(e.target.value)}
                required
                minLength={2}
                maxLength={150}
              />
            </label>
            <label>
              Email
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </label>
            <label>
              Contraseña
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={6}
              />
            </label>
            <button type="submit" disabled={saving}>
              {saving ? "Creando…" : "Crear cajero"}
            </button>
          </form>
        </section>

        <section className="equipo-card">
          <h2>Miembros</h2>
          {loading && <p className="equipo-muted">Cargando…</p>}
          {!loading && (
            <ul className="equipo-list">
              {miembros.map((m) => (
                <li key={m.id}>
                  <div>
                    <strong>{m.nombre}</strong>
                    <span>{m.email}</span>
                  </div>
                  <em>
                    {m.rol}
                    {!m.membresia_activa || !m.activo ? " · inactivo" : ""}
                  </em>
                </li>
              ))}
              {miembros.length === 0 && (
                <li className="equipo-muted">Aún no hay cuentas.</li>
              )}
            </ul>
          )}
        </section>
      </main>
    </div>
  );
}
