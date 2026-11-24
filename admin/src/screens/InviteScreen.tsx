import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { ApiError, errorMessage } from '../api/client';
import { inviteApi } from '../api/endpoints';
import type { InviteAcceptResponse } from '../api/types';
import { ErrorText } from '../components/Banner';
import { groupSecret } from '../format';
import { es } from '../i18n/es';
import { href, parseHash, paths } from '../router';

export const MIN_PASSWORD_LENGTH = 12;

/** Reads the invite token from `#/invitacion?token=…`. */
export function readInviteToken(hash: string): string {
  return parseHash(hash).query.get('token') ?? '';
}

/** Removes the token from the address bar (and from history). */
export function stripInviteToken(): void {
  const { pathname, search } = window.location;
  window.history.replaceState(
    window.history.state,
    '',
    `${pathname}${search}#${paths.invite}`,
  );
}

type Step =
  | { kind: 'checking' }
  | { kind: 'invalid'; message: string }
  | { kind: 'password'; email: string }
  | { kind: 'enroll'; email: string; enrollment: InviteAcceptResponse }
  | { kind: 'done' };

export function InviteScreen() {
  // Captured once, kept only in memory; the URL is cleaned on mount.
  const [token] = useState(() => readInviteToken(window.location.hash));
  const [step, setStep] = useState<Step>(() =>
    token
      ? { kind: 'checking' }
      : { kind: 'invalid', message: es.invite.missingToken },
  );

  useEffect(() => {
    stripInviteToken();
  }, []);

  useEffect(() => {
    if (!token) return;
    let active = true;
    inviteApi.inspect(token).then(
      ({ email }) => {
        if (active) setStep({ kind: 'password', email });
      },
      (err: unknown) => {
        if (!active) return;
        setStep({
          kind: 'invalid',
          message:
            err instanceof ApiError &&
            (err.status === 400 || err.status === 404)
              ? es.invite.invalid
              : errorMessage(err),
        });
      },
    );
    return () => {
      active = false;
    };
  }, [token]);

  return (
    <main id="main" className="auth-page">
      <div className="auth-card">
        <p className="brand">
          {es.app.name} <span className="muted">{es.app.subtitle}</span>
        </p>
        <h1>{step.kind === 'done' ? es.invite.doneTitle : es.invite.title}</h1>
        {step.kind === 'checking' ? (
          <p role="status">{es.invite.checking}</p>
        ) : null}
        {step.kind === 'invalid' ? (
          <p className="banner banner--error" role="alert">
            {step.message}
          </p>
        ) : null}
        {step.kind === 'password' ? (
          <PasswordStep
            token={token}
            email={step.email}
            onAccepted={(enrollment) =>
              setStep({ kind: 'enroll', email: step.email, enrollment })
            }
          />
        ) : null}
        {step.kind === 'enroll' ? (
          <EnrollStep
            token={token}
            enrollment={step.enrollment}
            onDone={() => setStep({ kind: 'done' })}
          />
        ) : null}
        {step.kind === 'done' ? (
          <>
            <p role="status">{es.invite.doneBody}</p>
            <a className="button button--primary" href={href(paths.login)}>
              {es.invite.goToLogin}
            </a>
          </>
        ) : null}
      </div>
    </main>
  );
}

function PasswordStep({
  token,
  email,
  onAccepted,
}: {
  token: string;
  email: string;
  onAccepted: (enrollment: InviteAcceptResponse) => void;
}) {
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (password.length < MIN_PASSWORD_LENGTH) {
      setError(es.invite.passwordTooShort);
      return;
    }
    if (password !== confirm) {
      setError(es.invite.passwordMismatch);
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const enrollment = await inviteApi.accept(token, password);
      onAccepted(enrollment);
    } catch (err) {
      setError(
        err instanceof ApiError && err.status === 400
          ? es.invite.acceptFailed
          : errorMessage(err),
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={(e) => void submit(e)} noValidate>
      <p>{es.invite.forEmail(email)}</p>
      <ErrorText>{error}</ErrorText>
      <input
        type="email"
        autoComplete="username"
        value={email}
        readOnly
        hidden
      />
      <div className="field">
        <label htmlFor="invite-password">{es.invite.password}</label>
        <input
          id="invite-password"
          type="password"
          autoComplete="new-password"
          minLength={MIN_PASSWORD_LENGTH}
          required
          aria-describedby="invite-password-hint"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        <p id="invite-password-hint" className="hint">
          {es.invite.passwordHint}
        </p>
      </div>
      <div className="field">
        <label htmlFor="invite-password-confirm">
          {es.invite.passwordConfirm}
        </label>
        <input
          id="invite-password-confirm"
          type="password"
          autoComplete="new-password"
          required
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
        />
      </div>
      <button
        type="submit"
        className="button button--primary button--block"
        disabled={busy}
      >
        {busy ? es.common.working : es.invite.passwordSubmit}
      </button>
    </form>
  );
}

function EnrollStep({
  token,
  enrollment,
  onDone,
}: {
  token: string;
  enrollment: InviteAcceptResponse;
  onDone: () => void;
}) {
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copyStatus, setCopyStatus] = useState<string | null>(null);
  const grouped = groupSecret(enrollment.totpSecret);
  const isOtpUri = enrollment.otpauthUri.startsWith('otpauth://');

  async function copy() {
    try {
      await navigator.clipboard.writeText(enrollment.totpSecret);
      setCopyStatus(es.invite.copied);
    } catch {
      setCopyStatus(es.invite.copyFailed);
    }
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await inviteApi.confirm(token, code.trim());
      onDone();
    } catch (err) {
      setError(
        err instanceof ApiError && (err.status === 400 || err.status === 401)
          ? es.invite.codeInvalid
          : errorMessage(err),
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={(e) => void submit(e)} noValidate>
      <h2>{es.invite.enrollTitle}</h2>
      <p>{es.invite.enrollIntro}</p>
      <p className="muted">{es.invite.enrollManual}</p>
      <p className="field-label" id="invite-secret-label">
        {es.invite.enrollSecretLabel}
      </p>
      <div className="secret-row">
        <code className="secret" aria-labelledby="invite-secret-label">
          {grouped}
        </code>
        <button
          type="button"
          className="button button--secondary"
          onClick={() => void copy()}
        >
          {es.invite.copy}
        </button>
      </div>
      {copyStatus ? (
        <p className="hint" role="status">
          {copyStatus}
        </p>
      ) : null}
      {isOtpUri ? (
        <p>
          <a href={enrollment.otpauthUri} className="link-button">
            {es.invite.openApp}
          </a>
          <span className="hint block">{es.invite.openAppHint}</span>
        </p>
      ) : null}
      <ErrorText>{error}</ErrorText>
      <div className="field">
        <label htmlFor="invite-code">{es.invite.codeLabel}</label>
        <input
          id="invite-code"
          type="text"
          inputMode="numeric"
          autoComplete="one-time-code"
          maxLength={6}
          required
          value={code}
          onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
        />
      </div>
      <button
        type="submit"
        className="button button--primary button--block"
        disabled={busy || code.length !== 6}
      >
        {busy ? es.common.working : es.invite.confirmSubmit}
      </button>
    </form>
  );
}
