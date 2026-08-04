import { FormEvent, useState } from "react";
import LogoMark from "../components/LogoMark";
import "./LoginPage.css";

type ChangePasswordPageProps = {
  onSubmit: (actual: string, nueva: string) => void | Promise<void>;
  loading: boolean;
  error: string | null;
  forced?: boolean;
};

export default function ChangePasswordPage({
  onSubmit,
  loading,
  error,
  forced = true,
}: ChangePasswordPageProps) {
  const [actual, setActual] = useState("");
  const [nueva, setNueva] = useState("");
  const [confirm, setConfirm] = useState("");
  const [localError, setLocalError] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setLocalError(null);
    if (nueva.length < 6) {
      setLocalError("La nueva contraseña debe tener al menos 6 caracteres.");
      return;
    }
    if (nueva !== confirm) {
      setLocalError("La confirmación no coincide.");
      return;
    }
    if (nueva === actual) {
      setLocalError("La nueva contraseña debe ser distinta a la actual.");
      return;
    }
    await onSubmit(actual, nueva);
  }

  return (
    <main className="login-screen">
      <div className="login-card">
        <header className="login-brand">
          <LogoMark className="login-logo-mark" gradientId="chg-pass-mark" />
          <span className="login-brand-name">ScaleUpp</span>
        </header>

        <h1 className="login-title">
          {forced ? "Cambia tu contraseña" : "Nueva contraseña"}
        </h1>
        {forced && (
          <p className="login-info" style={{ marginTop: 0 }}>
            Por seguridad, debes definir una contraseña nueva antes de continuar.
          </p>
        )}

        <form className="login-form" onSubmit={handleSubmit} noValidate>
          <label className="login-field">
            <span className="sr-only">Contraseña actual</span>
            <input
              type="password"
              value={actual}
              onChange={(e) => setActual(e.target.value)}
              placeholder="Contraseña actual"
              autoComplete="current-password"
              required
              minLength={6}
            />
          </label>
          <label className="login-field">
            <span className="sr-only">Nueva contraseña</span>
            <input
              type="password"
              value={nueva}
              onChange={(e) => setNueva(e.target.value)}
              placeholder="Nueva contraseña"
              autoComplete="new-password"
              required
              minLength={6}
            />
          </label>
          <label className="login-field">
            <span className="sr-only">Confirmar contraseña</span>
            <input
              type="password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              placeholder="Confirmar nueva contraseña"
              autoComplete="new-password"
              required
              minLength={6}
            />
          </label>

          {(localError || error) && (
            <p className="login-error" role="alert">
              {localError || error}
            </p>
          )}

          <button type="submit" className="login-submit" disabled={loading}>
            {loading ? "Guardando…" : "Guardar y continuar"}
          </button>
        </form>
      </div>
    </main>
  );
}
