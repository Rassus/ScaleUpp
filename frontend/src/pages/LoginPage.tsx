import { FormEvent, useState } from "react";
import { apiUrl } from "../api/config";
import LogoMark from "../components/LogoMark";
import { hashPasswordClient } from "../crypto/password";
import "./LoginPage.css";

type LoginPageProps = {
  onSubmit: (email: string, password: string) => void | Promise<void>;
  loading: boolean;
  error: string | null;
};

function suggestSlug(nombre: string): string {
  return nombre
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

export default function LoginPage({ onSubmit, loading, error }: LoginPageProps) {
  const [mode, setMode] = useState<"login" | "registro" | "olvide">("login");
  const [email, setEmail] = useState("owner@demo.com");
  const [password, setPassword] = useState("owner123");
  const [showPassword, setShowPassword] = useState(false);
  const [info, setInfo] = useState<string | null>(null);
  const [localError, setLocalError] = useState<string | null>(null);
  const [registering, setRegistering] = useState(false);
  const [forgotEmail, setForgotEmail] = useState("");
  const [forgotSending, setForgotSending] = useState(false);

  const [regNombre, setRegNombre] = useState("");
  const [regSlug, setRegSlug] = useState("");
  const [regComuna, setRegComuna] = useState("");
  const [regOwnerNombre, setRegOwnerNombre] = useState("");
  const [regOwnerEmail, setRegOwnerEmail] = useState("");
  const [regPass, setRegPass] = useState("");
  const [regPass2, setRegPass2] = useState("");

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setInfo(null);
    setLocalError(null);
    await onSubmit(email, password);
  }

  async function handleRegistro(e: FormEvent) {
    e.preventDefault();
    setInfo(null);
    setLocalError(null);
    if (regPass.length < 6) {
      setLocalError("La contraseña debe tener al menos 6 caracteres");
      return;
    }
    if (regPass !== regPass2) {
      setLocalError("Las contraseñas no coinciden");
      return;
    }
    setRegistering(true);
    try {
      const passwordDigest = await hashPasswordClient(regPass);
      const res = await fetch(apiUrl("/api/v1/auth/registro-negocio"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nombre: regNombre.trim(),
          slug: regSlug.trim().toLowerCase(),
          comuna: regComuna.trim(),
          owner_nombre: regOwnerNombre.trim(),
          owner_email: regOwnerEmail.trim().toLowerCase(),
          password: passwordDigest,
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(
          typeof body.detail === "string"
            ? body.detail
            : Array.isArray(body.detail)
              ? body.detail.map((d: { msg?: string }) => d.msg).filter(Boolean).join("; ") ||
                `Error ${res.status}`
              : `Error ${res.status}`,
        );
      }
      setMode("login");
      setEmail(regOwnerEmail.trim().toLowerCase());
      setPassword("");
      setRegNombre("");
      setRegSlug("");
      setRegComuna("");
      setRegOwnerNombre("");
      setRegOwnerEmail("");
      setRegPass("");
      setRegPass2("");
      setInfo(
        "Solicitud enviada. Te avisaremos cuando el negocio esté aprobado.",
      );
    } catch (err) {
      setLocalError(
        err instanceof Error ? err.message : "No se pudo enviar la solicitud",
      );
    } finally {
      setRegistering(false);
    }
  }

  async function handleOlvide(e: FormEvent) {
    e.preventDefault();
    setInfo(null);
    setLocalError(null);
    setForgotSending(true);
    try {
      const res = await fetch(apiUrl("/api/v1/auth/olvide-password"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: forgotEmail.trim().toLowerCase() }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(
          typeof body.detail === "string"
            ? body.detail
            : `Error ${res.status}`,
        );
      }
      const data = (await res.json()) as { mensaje: string };
      setMode("login");
      setEmail(forgotEmail.trim().toLowerCase());
      setForgotEmail("");
      setInfo(
        data.mensaje ||
          "Si el correo está registrado, un administrador revisará tu solicitud.",
      );
    } catch (err) {
      setLocalError(
        err instanceof Error ? err.message : "No se pudo enviar la solicitud",
      );
    } finally {
      setForgotSending(false);
    }
  }

  const displayError = mode === "login" ? error : localError;

  if (mode === "olvide") {
    return (
      <main className="login-screen">
        <div className="login-card">
          <header className="login-brand">
            <LogoMark className="login-logo-mark" gradientId="login-mark-forgot" />
            <span className="login-brand-name">ScaleUpp</span>
          </header>

          <h1 className="login-title">Olvidé mi contraseña</h1>
          <p className="login-lead">
            Ingresa tu correo. Un administrador te asignará una clave temporal.
          </p>

          <form
            className="login-form"
            onSubmit={(e) => void handleOlvide(e)}
            noValidate
          >
            <label className="login-field-plain">
              Correo
              <input
                type="email"
                value={forgotEmail}
                onChange={(e) => setForgotEmail(e.target.value)}
                autoComplete="email"
                required
              />
            </label>

            {displayError && (
              <p className="login-error" role="alert">
                {displayError}
              </p>
            )}

            <button
              type="submit"
              className="login-submit"
              disabled={forgotSending}
            >
              {forgotSending ? "Enviando…" : "Solicitar recuperación"}
            </button>
          </form>

          <p className="login-footer">
            <button
              type="button"
              className="login-link-accent"
              onClick={() => {
                setMode("login");
                setLocalError(null);
                setInfo(null);
              }}
            >
              Volver al login
            </button>
          </p>
        </div>
      </main>
    );
  }

  if (mode === "registro") {
    return (
      <main className="login-screen">
        <div className="login-card login-card-wide">
          <header className="login-brand">
            <LogoMark className="login-logo-mark" gradientId="login-mark-reg" />
            <span className="login-brand-name">ScaleUpp</span>
          </header>

          <h1 className="login-title">Crea tu negocio</h1>
          <p className="login-lead">
            Completa los datos. Un administrador revisará y activará tu cuenta.
          </p>

          <form className="login-form" onSubmit={(e) => void handleRegistro(e)} noValidate>
            <label className="login-field-plain">
              Nombre del negocio
              <input
                value={regNombre}
                onChange={(e) => {
                  const v = e.target.value;
                  setRegNombre(v);
                  if (!regSlug || regSlug === suggestSlug(regNombre)) {
                    setRegSlug(suggestSlug(v));
                  }
                }}
                placeholder="Ej. Minimarket Los Andes"
                required
                minLength={2}
              />
            </label>
            <label className="login-field-plain">
              Identificador (slug)
              <input
                value={regSlug}
                onChange={(e) => setRegSlug(e.target.value.toLowerCase())}
                pattern="^[a-z0-9]+(?:-[a-z0-9]+)*$"
                placeholder="minimarket-los-andes"
                required
              />
            </label>
            <label className="login-field-plain">
              Comuna
              <input
                value={regComuna}
                onChange={(e) => setRegComuna(e.target.value)}
                placeholder="Ej. Providencia, Maipú…"
                required
                minLength={2}
              />
            </label>
            <label className="login-field-plain">
              Tu nombre
              <input
                value={regOwnerNombre}
                onChange={(e) => setRegOwnerNombre(e.target.value)}
                required
                minLength={2}
              />
            </label>
            <label className="login-field-plain">
              Correo
              <input
                type="email"
                value={regOwnerEmail}
                onChange={(e) => setRegOwnerEmail(e.target.value)}
                autoComplete="email"
                required
              />
            </label>
            <label className="login-field-plain">
              Contraseña
              <input
                type="password"
                value={regPass}
                onChange={(e) => setRegPass(e.target.value)}
                autoComplete="new-password"
                minLength={6}
                required
              />
            </label>
            <label className="login-field-plain">
              Repetir contraseña
              <input
                type="password"
                value={regPass2}
                onChange={(e) => setRegPass2(e.target.value)}
                autoComplete="new-password"
                minLength={6}
                required
              />
            </label>

            {displayError && (
              <p className="login-error" role="alert">
                {displayError}
              </p>
            )}

            <button
              type="submit"
              className="login-submit"
              disabled={registering}
            >
              {registering ? "Enviando…" : "Enviar solicitud"}
            </button>
          </form>

          <p className="login-footer">
            ¿Ya tienes cuenta?{" "}
            <button
              type="button"
              className="login-link-accent"
              onClick={() => {
                setMode("login");
                setLocalError(null);
                setInfo(null);
              }}
            >
              Iniciar sesión
            </button>
          </p>
        </div>
      </main>
    );
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
              onClick={() => {
                setMode("olvide");
                setForgotEmail(email);
                setInfo(null);
                setLocalError(null);
              }}
            >
              Olvidé mi contraseña
            </button>
          </div>

          {displayError && (
            <p className="login-error" role="alert">
              {displayError}
            </p>
          )}
          {info && !displayError && (
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
            onClick={() => {
              setMode("registro");
              setInfo(null);
              setLocalError(null);
            }}
          >
            Crea tu negocio
          </button>
        </p>
      </div>
    </main>
  );
}
