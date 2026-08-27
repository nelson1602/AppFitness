import type { PostmarkMailConfig } from '../../../config/mail.config';
import { MailDeliveryError, type MailMessage } from '../domain/mail.types';
import {
  POSTMARK_EMAIL_ENDPOINT,
  PostmarkMailTransport,
} from './postmark.transport';

const CONFIG: PostmarkMailConfig = {
  provider: 'postmark',
  serverToken: 'super-secret-server-token',
  fromAddress: 'no-reply@mail.example.com',
  messageStream: 'outbound',
  publicBaseUrl: 'https://app.example.com',
};

const MESSAGE: MailMessage = {
  to: 'user@example.com',
  subject: 'Reset your AppFitness password',
  textBody: 'text with https://app.example.com/reset-password#token=raw-token',
  htmlBody: '<p>html</p>',
  templateId: 'password-reset',
  locale: 'en',
};

describe('PostmarkMailTransport', () => {
  let fetchMock: jest.Mock;

  beforeEach(() => {
    fetchMock = jest.fn();
    global.fetch = fetchMock;
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('posts the rendered message to the Postmark REST endpoint', async () => {
    fetchMock.mockResolvedValue({ ok: true, status: 200 });

    await new PostmarkMailTransport(CONFIG).send(MESSAGE);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe(POSTMARK_EMAIL_ENDPOINT);
    expect(init.method).toBe('POST');

    const headers = init.headers as Record<string, string>;
    expect(headers['X-Postmark-Server-Token']).toBe(CONFIG.serverToken);
    expect(headers['Content-Type']).toBe('application/json');

    expect(JSON.parse(init.body as string)).toEqual({
      From: 'no-reply@mail.example.com',
      To: 'user@example.com',
      Subject: MESSAGE.subject,
      TextBody: MESSAGE.textBody,
      HtmlBody: MESSAGE.htmlBody,
      MessageStream: 'outbound',
    });
  });

  it('reports the transport name without exposing a credential', () => {
    const transport = new PostmarkMailTransport(CONFIG);
    expect(transport.name).toBe('postmark');
    expect(transport.name).not.toContain(CONFIG.serverToken);
  });

  it('raises a delivery error carrying the status only when the provider rejects', async () => {
    fetchMock.mockResolvedValue({
      ok: false,
      status: 422,
      // A real Postmark error body echoes the recipient back; it must not leak.
      json: () => Promise.resolve({ Message: 'Invalid To: user@example.com' }),
    });

    const send = new PostmarkMailTransport(CONFIG).send(MESSAGE);

    await expect(send).rejects.toBeInstanceOf(MailDeliveryError);
    await expect(send).rejects.toThrow(/HTTP 422/);
    await expect(send).rejects.not.toThrow(/user@example\.com/);
  });

  it('raises a delivery error naming only the error class when the wire fails', async () => {
    fetchMock.mockRejectedValue(
      new TypeError('fetch failed for https://api.postmarkapp.com/email'),
    );

    const send = new PostmarkMailTransport(CONFIG).send(MESSAGE);

    await expect(send).rejects.toThrow(/provider unreachable \(TypeError\)/);
    await expect(send).rejects.not.toThrow(/postmarkapp/);
  });

  it('never puts the server token or the raw token into a thrown message', async () => {
    fetchMock.mockResolvedValue({ ok: false, status: 500 });

    await new PostmarkMailTransport(CONFIG)
      .send(MESSAGE)
      .catch((error: unknown) => {
        const text =
          error instanceof Error ? `${error.name}: ${error.message}` : '';
        expect(text).not.toContain(CONFIG.serverToken);
        expect(text).not.toContain('raw-token');
      });
    expect.hasAssertions();
  });

  it('bounds the provider call with a timeout signal', async () => {
    fetchMock.mockResolvedValue({ ok: true, status: 200 });

    await new PostmarkMailTransport(CONFIG).send(MESSAGE);

    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(init.signal).toBeInstanceOf(AbortSignal);
  });
});
