import { useState } from 'react';
import type { FormEvent } from 'react';
import { errorMessage } from '../api/client';
import { configApi } from '../api/endpoints';
import type { AppConfig, AppConfigInput, MaintenanceTone } from '../api/types';
import { Banner, ErrorText, Loading } from '../components/Banner';
import type { BannerMessage } from '../components/Banner';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { formatDateTime } from '../format';
import { useResource } from '../hooks/useResource';
import { es } from '../i18n/es';

/** Same limit the API enforces on each banner text. */
export const MESSAGE_MAX = 300;
const TONES: MaintenanceTone[] = ['info', 'warning'];

interface FormValues {
  maintenanceEnabled: boolean;
  maintenanceTone: MaintenanceTone;
  messageEs: string;
  messageEn: string;
  minAndroidVersionCode: string;
}

function toForm(config: AppConfig): FormValues {
  return {
    maintenanceEnabled: config.maintenanceEnabled,
    maintenanceTone: config.maintenanceTone,
    messageEs: config.maintenanceMessageEs ?? '',
    messageEn: config.maintenanceMessageEn ?? '',
    minAndroidVersionCode:
      config.minAndroidVersionCode === null
        ? ''
        : String(config.minAndroidVersionCode),
  };
}

type Validation =
  { ok: true; input: AppConfigInput } | { ok: false; error: string };

/** Mirrors the server rules; always produces all five keys. */
export function validateConfig(values: FormValues): Validation {
  const messageEs = values.messageEs.trim();
  const messageEn = values.messageEn.trim();
  if (values.maintenanceEnabled && (!messageEs || !messageEn)) {
    return { ok: false, error: es.config.messagesRequired };
  }
  if (messageEs.length > MESSAGE_MAX || messageEn.length > MESSAGE_MAX) {
    return { ok: false, error: es.config.messageTooLong(MESSAGE_MAX) };
  }
  const rawVersion = values.minAndroidVersionCode.trim();
  let minAndroidVersionCode: number | null = null;
  if (rawVersion) {
    const parsed = Number(rawVersion);
    if (!/^\d+$/.test(rawVersion) || !Number.isSafeInteger(parsed)) {
      return { ok: false, error: es.config.minAndroidInvalid };
    }
    if (parsed < 1) return { ok: false, error: es.config.minAndroidInvalid };
    minAndroidVersionCode = parsed;
  }
  return {
    ok: true,
    input: {
      maintenanceEnabled: values.maintenanceEnabled,
      maintenanceTone: values.maintenanceTone,
      maintenanceMessageEs: messageEs || null,
      maintenanceMessageEn: messageEn || null,
      minAndroidVersionCode,
    },
  };
}

export function ConfigScreen() {
  const { data, error, loading, reload } = useResource('config', () =>
    configApi.get(),
  );
  const [banner, setBanner] = useState<BannerMessage | null>(null);

  async function save(input: AppConfigInput): Promise<void> {
    try {
      await configApi.update(input);
      setBanner({ kind: 'success', text: es.config.saved });
      reload();
    } catch (err) {
      setBanner({
        kind: 'error',
        text: es.config.saveFailed(errorMessage(err)),
      });
    }
  }

  return (
    <section aria-labelledby="config-title">
      <h1 id="config-title">{es.config.title}</h1>
      <Banner message={banner} onDismiss={() => setBanner(null)} />
      {error ? <ErrorText>{errorMessage(error)}</ErrorText> : null}
      {loading && !data ? <Loading /> : null}
      {data ? (
        <>
          <p className="muted">
            {es.config.updatedAt(formatDateTime(data.updatedAt))}
          </p>
          {/* Remount with fresh values after every successful save. */}
          <ConfigForm key={data.updatedAt} config={data} onSave={save} />
        </>
      ) : null}
    </section>
  );
}

function ConfigForm({
  config,
  onSave,
}: {
  config: AppConfig;
  onSave: (input: AppConfigInput) => Promise<void>;
}) {
  const [values, setValues] = useState<FormValues>(() => toForm(config));
  const [formError, setFormError] = useState<string | null>(null);
  const [pending, setPending] = useState<AppConfigInput | null>(null);
  const [busy, setBusy] = useState(false);

  function set<K extends keyof FormValues>(key: K, value: FormValues[K]) {
    setValues((prev) => ({ ...prev, [key]: value }));
  }

  function submit(event: FormEvent) {
    event.preventDefault();
    const result = validateConfig(values);
    if (!result.ok) {
      setFormError(result.error);
      return;
    }
    setFormError(null);
    setPending(result.input);
  }

  async function confirm(input: AppConfigInput) {
    setBusy(true);
    // On success the parent also remounts this form with the saved values.
    await onSave(input);
    setBusy(false);
    setPending(null);
  }

  return (
    <form onSubmit={submit} noValidate>
      <ErrorText>{formError}</ErrorText>
      <fieldset>
        <legend>{es.config.maintenanceTitle}</legend>
        <div className="checkbox">
          <input
            id="config-enabled"
            type="checkbox"
            checked={values.maintenanceEnabled}
            onChange={(e) => set('maintenanceEnabled', e.target.checked)}
          />
          <label htmlFor="config-enabled">{es.config.maintenanceEnabled}</label>
        </div>
        <fieldset>
          <legend>{es.config.tone}</legend>
          <div className="radio-row">
            {TONES.map((tone) => (
              <div key={tone} className="checkbox">
                <input
                  id={`config-tone-${tone}`}
                  type="radio"
                  name="config-tone"
                  value={tone}
                  checked={values.maintenanceTone === tone}
                  onChange={() => set('maintenanceTone', tone)}
                />
                <label htmlFor={`config-tone-${tone}`}>
                  {es.config.tones[tone]}
                </label>
              </div>
            ))}
          </div>
        </fieldset>
        <MessageField
          id="config-message-es"
          label={es.config.messageEs}
          value={values.messageEs}
          required={values.maintenanceEnabled}
          onChange={(value) => set('messageEs', value)}
        />
        <MessageField
          id="config-message-en"
          label={es.config.messageEn}
          value={values.messageEn}
          required={values.maintenanceEnabled}
          onChange={(value) => set('messageEn', value)}
        />
        <p className="hint">{es.config.bannerHint}</p>
        <BannerPreview values={values} />
      </fieldset>

      <fieldset>
        <legend>{es.config.versionTitle}</legend>
        <div className="field">
          <label htmlFor="config-min-android">
            {es.config.minAndroidVersionCode}
          </label>
          <input
            id="config-min-android"
            type="number"
            inputMode="numeric"
            min={1}
            step={1}
            aria-describedby="config-min-android-hint"
            value={values.minAndroidVersionCode}
            onChange={(e) => set('minAndroidVersionCode', e.target.value)}
          />
          <p id="config-min-android-hint" className="hint">
            {es.config.minAndroidHint}
          </p>
        </div>
      </fieldset>

      <div className="button-row">
        <button type="submit" className="button button--primary">
          {es.config.save}
        </button>
      </div>

      {pending ? (
        <ConfirmDialog
          title={es.config.confirmTitle}
          confirmLabel={es.config.confirm}
          busy={busy}
          onCancel={() => setPending(null)}
          onConfirm={() => void confirm(pending)}
        >
          <ConfigSummary input={pending} />
        </ConfirmDialog>
      ) : null}
    </form>
  );
}

function MessageField({
  id,
  label,
  value,
  required,
  onChange,
}: {
  id: string;
  label: string;
  value: string;
  required: boolean;
  onChange: (value: string) => void;
}) {
  const counterId = `${id}-counter`;
  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      <textarea
        id={id}
        rows={3}
        maxLength={MESSAGE_MAX}
        required={required}
        aria-describedby={counterId}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
      <p id={counterId} className="hint" aria-live="polite">
        {es.config.counter(value.length, MESSAGE_MAX)}
      </p>
    </div>
  );
}

function BannerPreview({ values }: { values: FormValues }) {
  const messages = [values.messageEs.trim(), values.messageEn.trim()];
  return (
    <section className="field" aria-labelledby="config-preview-title">
      <h2 id="config-preview-title" className="field-label">
        {es.config.previewTitle}
      </h2>
      <div className={`preview preview--${values.maintenanceTone}`}>
        {messages.map((message, index) => (
          <p key={index} className="preview__text">
            {message || es.config.previewEmpty}
          </p>
        ))}
      </div>
    </section>
  );
}

function ConfigSummary({ input }: { input: AppConfigInput }) {
  return (
    <>
      <p>{es.config.confirmIntro}</p>
      <dl className="details">
        <dt>{es.config.summaryBanner}</dt>
        <dd>
          {input.maintenanceEnabled
            ? es.config.summaryOn
            : es.config.summaryOff}
        </dd>
        <dt>{es.config.tone}</dt>
        <dd>{es.config.tones[input.maintenanceTone]}</dd>
        <dt>{es.config.messageEs}</dt>
        <dd>{input.maintenanceMessageEs ?? es.common.dash}</dd>
        <dt>{es.config.messageEn}</dt>
        <dd>{input.maintenanceMessageEn ?? es.common.dash}</dd>
        <dt>{es.config.minAndroidVersionCode}</dt>
        <dd>
          {input.minAndroidVersionCode === null
            ? es.config.noMinimum
            : String(input.minAndroidVersionCode)}
        </dd>
      </dl>
    </>
  );
}
