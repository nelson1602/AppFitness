import { useState } from 'react';
import type { FormEvent } from 'react';
import { ApiError, errorMessage } from '../api/client';
import { authApi } from '../api/endpoints';
import type { Me } from '../api/types';
import { ErrorText } from '../components/Banner';
import { es } from '../i18n/es';

interface LoginScreenProps {
  onLoggedIn: (me: Me) => void;
  notice?: string | null;
}

type Step = 'credentials' | 'totp';

export function LoginScreen({ onLoggedIn, notice = null }: LoginScreenProps) {
  const [step, setStep] = useState<Step>('credentials');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submitCredentials(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await authApi.login(email.trim(), password);
      setPassword('');
      setStep('totp');
    } catch (err) {
      setError(
        err instanceof ApiError && err.status === 401
          ? es.login.invalidCredentials
          : errorMessage(err),
      );
    } finally {
      setBusy(false);
    }
  }

  async function submitCode(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const me = await authApi.totp(code.trim());
      onLoggedIn(me);
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        setCode('');
        setStep('credentials');
        setError(es.login.totpInvalid);
      } else {
        setError(errorMessage(err));
      }
    } finally {
      setBusy(false);
    }
  }

  function back() {
    setStep('credentials');
    setCode('');
    setError(null);
  }

  return (
    <main id="main" className="auth-page">
      <div className="auth-card">
        <p className="brand">
          {es.app.name} <span className="muted">{es.app.subtitle}</span>
        </p>
        {step === 'credentials' ? (
          <form onSubmit={(e) => void submitCredentials(e)} noValidate>
            <h1>{es.login.title}</h1>
            <p className="muted">{es.login.intro}</p>
            {notice && !error ? (
              <p className="banner banner--error" role="alert">
                {notice}
              </p>
            ) : null}
            <ErrorText>{error}</ErrorText>
            <div className="field">
              <label htmlFor="login-email">{es.login.email}</label>
              <input
                id="login-email"
                type="email"
                autoComplete="username"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            <div className="field">
              <label htmlFor="login-password">{es.login.password}</label>
              <input
                id="login-password"
                type="password"
                autoComplete="current-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
            <button
              type="submit"
              className="button button--primary button--block"
              disabled={busy || !email.trim() || !password}
            >
              {busy ? es.login.submitting : es.login.submit}
            </button>
          </form>
        ) : (
          <form onSubmit={(e) => void submitCode(e)} noValidate>
            <h1>{es.login.totpTitle}</h1>
            <p className="muted">{es.login.totpIntro}</p>
            <ErrorText>{error}</ErrorText>
            <div className="field">
              <label htmlFor="login-totp">{es.login.totpCode}</label>
              <input
                id="login-totp"
                type="text"
                inputMode="numeric"
                autoComplete="one-time-code"
                pattern="[0-9]{6}"
                maxLength={6}
                required
                aria-describedby="login-totp-hint"
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
                autoFocus
              />
              <p id="login-totp-hint" className="hint">
                {es.login.totpHint}
              </p>
            </div>
            <div className="button-row">
              <button
                type="button"
                className="button button--secondary"
                onClick={back}
                disabled={busy}
              >
                {es.login.back}
              </button>
              <button
                type="submit"
                className="button button--primary"
                disabled={busy || code.length !== 6}
              >
                {busy ? es.login.submitting : es.login.totpSubmit}
              </button>
            </div>
          </form>
        )}
      </div>
    </main>
  );
}
