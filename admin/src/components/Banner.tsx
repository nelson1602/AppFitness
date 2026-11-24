import { es } from '../i18n/es';

export interface BannerMessage {
  kind: 'success' | 'error';
  text: string;
}

interface BannerProps {
  message: BannerMessage | null;
  onDismiss?: () => void;
}

/** Success uses a polite status region; errors use role="alert". */
export function Banner({ message, onDismiss }: BannerProps) {
  if (!message) return null;
  return (
    <div
      className={`banner banner--${message.kind}`}
      role={message.kind === 'error' ? 'alert' : 'status'}
    >
      <span>{message.text}</span>
      {onDismiss ? (
        <button
          type="button"
          className="button button--ghost"
          onClick={onDismiss}
        >
          {es.dialog.close}
        </button>
      ) : null}
    </div>
  );
}

export function ErrorText({ children }: { children: string | null }) {
  if (!children) return null;
  return (
    <p className="error-text" role="alert">
      {children}
    </p>
  );
}

export function Loading() {
  return (
    <p className="muted" role="status">
      {es.app.loading}
    </p>
  );
}
