import { FormEvent, useState } from "react";
import LogoMark from "../components/LogoMark";
import "./LoginPage.css";

type LoginPageProps = {
  onSubmit: (email: string, password: string) => void | Promise<void>;
  loading: boolean;
  error: string | null;
};

export default function LoginPage({ onSubmit, loading, error }: LoginPageProps) {
  const [email, setEmail] = useState("owner@demo.com");
  const [password, setPassword] = useState("owner123");
  const [showPassword, setShowPassword] = useState(false);
  const [info, setInfo] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setInfo(null);
    await onSubmit(email, password);
  }

  return (
    <main className="login-screen">
      <div className="login-card">
        <header className="login-brand">
          <LogoMark className="login-logo-mark" gradientId="login-mark" />
          <span className="login-brand-name">ScaleUpp</span>
        </header>

        <h1 className="login-title">Bienvenido de nuevo</h1>

        <form className="login-form" onSubmit={handleSubmit} noValidate>
          <label className="login-field">
            <span className="sr-only">Correo electrónico</span>
            <span className="login-field-icon" aria-hidden="true">
              <svg viewBox="0 0 24 24" width="20" height="20" fill="none">
                <path
                  d="M4 6.5h16v11H4v-11z"
                  stroke="currentColor"
                  strokeWidth="1.6"
                />
                <path
                  d="M4.5 7l7.5 6 7.5-6"
                  stroke="currentColor"
                  strokeWidth="1.6"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </span>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Correo electrónico"
              autoComplete="username"
              required
            />
          </label>

          <label className="login-field">
            <span className="sr-only">Contraseña</span>
            <span className="login-field-icon" aria-hidden="true">
              <svg viewBox="0 0 24 24" width="20" height="20" fill="none">
                <rect
                  x="5"
                  y="10"
                  width="14"
                  height="10"
                  rx="2"
                  stroke="currentColor"
                  strokeWidth="1.6"
                />
                <path
                  d="M8 10V7.5a4 4 0 0 1 8 0V10"
                  stroke="currentColor"
                  strokeWidth="1.6"
                  strokeLinecap="round"
                />
              </svg>
            </span>
            <input
              type={showPassword ? "text" : "password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Contraseña"
              autoComplete="current-password"
              required
              minLength={6}
            />
            <button
              type="button"
              className="login-eye"
              onClick={() => setShowPassword((v) => !v)}
              aria-label={showPassword ? "Ocultar contraseña" : "Mostrar contraseña"}
            >
              {showPassword ? (
                <svg viewBox="0 0 24 24" width="20" height="20" fill="none">
                  <path
                    d="M3 12s3.5-6 9-6 9 6 9 6-3.5 6-9 6-9-6-9-6z"
                    stroke="currentColor"
                    strokeWidth="1.6"
                  />
                  <circle
                    cx="12"
                    cy="12"
                    r="2.5"
                    stroke="currentColor"
                    strokeWidth="1.6"
                  />
                </svg>
              ) : (
                <svg viewBox="0 0 24 24" width="20" height="20" fill="none">
                  <path
                    d="M3 12s3.5-6 9-6 9 6 9 6-3.5 6-9 6-9-6-9-6z"
                    stroke="currentColor"
                    strokeWidth="1.6"
                  />
                  <path
                    d="M4 4l16 16"
                    stroke="currentColor"
                    strokeWidth="1.6"
                    strokeLinecap="round"
                  />
                </svg>
              )}
            </button>
          </label>

          <div className="login-forgot-row">
            <button
              type="button"
              className="login-link-muted"
              onClick={() => setInfo("Recuperación de contraseña: próximamente.")}
            >
              Olvidé mi contraseña
            </button>
          </div>

          {error && (
            <p className="login-error" role="alert">
              {error}
            </p>
          )}
          {info && !error && (
            <p className="login-info" role="status">
              {info}
            </p>
          )}

          <button type="submit" className="login-submit" disabled={loading}>
            <svg
              viewBox="0 0 24 24"
              width="18"
              height="18"
              fill="none"
              aria-hidden="true"
            >
              <path
                d="M10 7v10"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
              />
              <path
                d="M10 12h9m0 0l-3-3m3 3l-3 3"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <path
                d="M5 5v14"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
              />
            </svg>
            {loading ? "Entrando…" : "Iniciar Sesión"}
          </button>
        </form>

        <p className="login-footer">
          ¿Eres nuevo?{" "}
          <button
            type="button"
            className="login-link-accent"
            onClick={() => setInfo("Alta de negocio: próximamente.")}
          >
            Crea tu negocio
          </button>
        </p>
      </div>
    </main>
  );
}
