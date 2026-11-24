import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import type { AppConfig } from '../api/types';
import { es } from '../i18n/es';
import { countCalls, mockFetch } from '../test/fetchMock';
import { ConfigScreen } from './ConfigScreen';

const config: AppConfig = {
  maintenanceEnabled: false,
  maintenanceTone: 'info',
  maintenanceMessageEs: null,
  maintenanceMessageEn: null,
  minAndroidVersionCode: null,
  updatedAt: '2026-11-20T10:00:00.000Z',
};

type FetchCall = [input: RequestInfo | URL, init?: RequestInit];

/** Parsed JSON body of the PUT call (the GET shares the same URL). */
function putBody(calls: FetchCall[]): unknown {
  const body = calls.find(([, init]) => init?.method === 'PUT')?.[1]?.body;
  return typeof body === 'string' ? (JSON.parse(body) as unknown) : undefined;
}

describe('ConfigScreen', () => {
  it('blocks saving when the banner is enabled without both texts', async () => {
    const user = userEvent.setup();
    const fetchMock = mockFetch({
      'GET config': { body: config },
      'PUT config': { body: config },
    });

    render(<ConfigScreen />);

    await user.click(
      await screen.findByLabelText(es.config.maintenanceEnabled),
    );
    await user.type(screen.getByLabelText(es.config.messageEs), 'Hola');
    await user.click(screen.getByRole('button', { name: es.config.save }));

    expect(screen.getByRole('alert')).toHaveTextContent(
      es.config.messagesRequired,
    );
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(countCalls(fetchMock.mock.calls, 'config')).toBe(1);
  });

  it('shows the last update, a live counter and a preview in the chosen tone', async () => {
    const user = userEvent.setup();
    mockFetch({ 'GET config': { body: config } });

    render(<ConfigScreen />);

    const textarea = await screen.findByLabelText(es.config.messageEs);
    expect(
      screen.getByText(new RegExp(`^${es.config.updatedAt('')}`)),
    ).toBeInTheDocument();
    await user.type(textarea, 'Mantenimiento');
    expect(textarea).toHaveAccessibleDescription(es.config.counter(13, 300));

    const preview = screen.getByRole('region', {
      name: es.config.previewTitle,
    });
    expect(preview).toHaveTextContent('Mantenimiento');
    await user.click(screen.getByLabelText(es.config.tones.warning));
    expect(preview.querySelector('.preview--warning')).not.toBeNull();
  });

  it('confirms and PUTs all five keys, sending null for empty values', async () => {
    const user = userEvent.setup();
    const saved: AppConfig = {
      ...config,
      minAndroidVersionCode: 12,
      updatedAt: '2026-11-24T09:00:00.000Z',
    };
    const fetchMock = mockFetch({
      'GET config': { body: config },
      'PUT config': { body: saved },
    });

    render(<ConfigScreen />);

    await user.type(
      await screen.findByLabelText(es.config.minAndroidVersionCode),
      '12',
    );
    await user.type(screen.getByLabelText(es.config.messageEs), '   ');
    await user.click(screen.getByRole('button', { name: es.config.save }));

    const dialog = screen.getByRole('dialog', {
      name: es.config.confirmTitle,
    });
    expect(dialog).toHaveTextContent(es.config.summaryOff);
    await user.click(
      within(dialog).getByRole('button', { name: es.config.confirm }),
    );

    expect(await screen.findByRole('status')).toHaveTextContent(
      es.config.saved,
    );
    expect(putBody(fetchMock.mock.calls)).toEqual({
      maintenanceEnabled: false,
      maintenanceTone: 'info',
      maintenanceMessageEs: null,
      maintenanceMessageEn: null,
      minAndroidVersionCode: 12,
    });
  });

  it('sends both texts and the tone when the banner is enabled', async () => {
    const user = userEvent.setup();
    const fetchMock = mockFetch({
      'GET config': { body: config },
      'PUT config': {
        body: { ...config, updatedAt: '2026-11-24T09:00:00.000Z' },
      },
    });

    render(<ConfigScreen />);

    await user.click(
      await screen.findByLabelText(es.config.maintenanceEnabled),
    );
    await user.click(screen.getByLabelText(es.config.tones.warning));
    await user.type(screen.getByLabelText(es.config.messageEs), ' Hola ');
    await user.type(screen.getByLabelText(es.config.messageEn), 'Hello');
    await user.click(screen.getByRole('button', { name: es.config.save }));
    await user.click(
      within(screen.getByRole('dialog')).getByRole('button', {
        name: es.config.confirm,
      }),
    );

    await screen.findByRole('status');
    expect(putBody(fetchMock.mock.calls)).toEqual({
      maintenanceEnabled: true,
      maintenanceTone: 'warning',
      maintenanceMessageEs: 'Hola',
      maintenanceMessageEn: 'Hello',
      minAndroidVersionCode: null,
    });
  });
});
