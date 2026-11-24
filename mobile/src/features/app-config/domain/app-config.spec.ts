import { EMPTY_APP_CONFIG, MAINTENANCE_MESSAGE_MAX_LENGTH, parseAppConfig } from './app-config';

describe('parseAppConfig (ADR-P049 amendment 1)', () => {
  it('reads a valid answer, trimming the messages', () => {
    expect(
      parseAppConfig({
        maintenance: {
          tone: 'info',
          message: { es: '  Mantenimiento hoy ', en: ' Maintenance today\n' },
        },
        minAndroidVersionCode: 15,
      }),
    ).toEqual({
      maintenance: { tone: 'info', message: { es: 'Mantenimiento hoy', en: 'Maintenance today' } },
      minAndroidVersionCode: 15,
    });
  });

  it('reads a null notice and a null minimum version', () => {
    expect(parseAppConfig({ maintenance: null, minAndroidVersionCode: null })).toEqual(
      EMPTY_APP_CONFIG,
    );
  });

  it('turns anything that is not an object into the empty config', () => {
    for (const body of [null, undefined, 'maintenance', 42, true, [], [{ maintenance: null }]]) {
      expect(parseAppConfig(body)).toEqual(EMPTY_APP_CONFIG);
    }
  });

  it('drops a malformed notice and a malformed minimum version', () => {
    for (const maintenance of [
      'down',
      { tone: 'info' },
      { tone: 'info', message: 'Mantenimiento' },
      { tone: 'info', message: { es: 7, en: null } },
      { tone: 'info', message: { es: '   ', en: '' } },
      [{ tone: 'info', message: { es: 'a', en: 'b' } }],
    ]) {
      expect(parseAppConfig({ maintenance }).maintenance).toBeNull();
    }
    for (const minAndroidVersionCode of ['15', 0, -3, 1.5, Number.NaN, Infinity, 2 ** 60]) {
      expect(parseAppConfig({ minAndroidVersionCode }).minAndroidVersionCode).toBeNull();
    }
  });

  it('keeps a valid notice when the minimum version is malformed, and the other way round', () => {
    const notice = { tone: 'warning', message: { es: 'Aviso', en: 'Notice' } };
    expect(parseAppConfig({ maintenance: notice, minAndroidVersionCode: 'x' })).toEqual({
      maintenance: notice,
      minAndroidVersionCode: null,
    });
    expect(parseAppConfig({ maintenance: 'x', minAndroidVersionCode: 12 })).toEqual({
      maintenance: null,
      minAndroidVersionCode: 12,
    });
  });

  it('shows any tone other than info as a warning', () => {
    for (const tone of ['error', 'success', 'INFO', undefined, 3]) {
      const config = parseAppConfig({ maintenance: { tone, message: { es: 'a', en: 'b' } } });
      expect(config.maintenance?.tone).toBe('warning');
    }
  });

  it('fills a missing language from the other one', () => {
    expect(
      parseAppConfig({ maintenance: { tone: 'info', message: { es: 'Solo español' } } }),
    ).toEqual({
      maintenance: { tone: 'info', message: { es: 'Solo español', en: 'Solo español' } },
      minAndroidVersionCode: null,
    });
  });

  it('caps a long message at 300 characters without splitting an emoji', () => {
    const long = 'a'.repeat(MAINTENANCE_MESSAGE_MAX_LENGTH + 50);
    const emoji = `${'b'.repeat(MAINTENANCE_MESSAGE_MAX_LENGTH - 1)}🔧🔧🔧`;
    const config = parseAppConfig({
      maintenance: { tone: 'info', message: { es: long, en: emoji } },
    });
    expect(config.maintenance?.message.es).toBe('a'.repeat(MAINTENANCE_MESSAGE_MAX_LENGTH));
    expect(config.maintenance?.message.en).toBe(
      `${'b'.repeat(MAINTENANCE_MESSAGE_MAX_LENGTH - 1)}🔧`,
    );
    expect(Array.from(config.maintenance?.message.en ?? '')).toHaveLength(
      MAINTENANCE_MESSAGE_MAX_LENGTH,
    );
  });
});
