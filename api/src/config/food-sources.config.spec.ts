import {
  EXTERNAL_FOOD_TIMEOUT_MS,
  resolveFoodSourcesConfig,
} from './food-sources.config';

describe('resolveFoodSourcesConfig (ADR-P045)', () => {
  it('uses a trimmed FDC_API_KEY without logging anything', () => {
    const logger = { warn: jest.fn() };
    expect(
      resolveFoodSourcesConfig({ FDC_API_KEY: '  secret-key ' }, logger),
    ).toEqual({ fdcApiKey: 'secret-key', timeoutMs: EXTERNAL_FOOD_TIMEOUT_MS });
    expect(logger.warn).not.toHaveBeenCalled();
  });

  it.each([undefined, '', '   '])(
    'disables FDC with one warning when the key is %p',
    (value) => {
      const logger = { warn: jest.fn() };
      expect(
        resolveFoodSourcesConfig({ FDC_API_KEY: value }, logger).fdcApiKey,
      ).toBeNull();
      expect(logger.warn).toHaveBeenCalledTimes(1);
    },
  );

  it('times every external call out after 4 s', () => {
    expect(EXTERNAL_FOOD_TIMEOUT_MS).toBe(4000);
  });
});
