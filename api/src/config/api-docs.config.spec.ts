import type { INestApplication } from '@nestjs/common';

import { isApiDocsEnabled, setupApiDocs } from './api-docs.config';

// Mock @nestjs/swagger with factory-local jest.fns (no TDZ), retrieved below
// as plain jest.Mock types (sidesteps @typescript-eslint/unbound-method).
jest.mock('@nestjs/swagger', () => {
  class MockDocumentBuilder {
    setTitle(): this {
      return this;
    }
    setDescription(): this {
      return this;
    }
    setVersion(): this {
      return this;
    }
    addBearerAuth(): this {
      return this;
    }
    build(): object {
      return { info: {} };
    }
  }
  return {
    DocumentBuilder: MockDocumentBuilder,
    SwaggerModule: {
      createDocument: jest.fn(() => ({ paths: {} })),
      setup: jest.fn(),
    },
  };
});

const { SwaggerModule: mockedSwagger } = jest.requireMock<{
  SwaggerModule: { createDocument: jest.Mock; setup: jest.Mock };
}>('@nestjs/swagger');

const fakeApp = {} as unknown as INestApplication;

const DISABLED_VALUES: Array<[string, string | undefined]> = [
  ['unset', undefined],
  ['empty', ''],
  ['false', 'false'],
  ['uppercase TRUE', 'TRUE'],
  ['mixed True', 'True'],
  ['numeric 1', '1'],
  ['yes', 'yes'],
  ['on', 'on'],
  ['whitespace " true "', ' true '],
  ['production', 'production'],
  ['arbitrary', 'anything-else'],
];

describe('isApiDocsEnabled (API_DOCS_ENABLED truth table, H-2)', () => {
  it('enables docs ONLY for the exact string "true"', () => {
    expect(isApiDocsEnabled('true')).toBe(true);
  });

  it.each(DISABLED_VALUES)('is false for %s', (_label, value) => {
    expect(isApiDocsEnabled(value)).toBe(false);
  });
});

describe('setupApiDocs (Swagger mount gate, H-2)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('mounts docs and builds the document only for "true"', () => {
    const mounted = setupApiDocs(fakeApp, 'true');

    expect(mounted).toBe(true);
    expect(mockedSwagger.createDocument).toHaveBeenCalledTimes(1);
    expect(mockedSwagger.setup).toHaveBeenCalledTimes(1);
    // Mounted at `docs` against the given app.
    expect(mockedSwagger.setup).toHaveBeenCalledWith(
      'docs',
      fakeApp,
      expect.anything(),
    );
  });

  it.each(DISABLED_VALUES)(
    'calls neither createDocument nor setup for %s',
    (_label, value) => {
      const mounted = setupApiDocs(fakeApp, value);

      expect(mounted).toBe(false);
      expect(mockedSwagger.createDocument).not.toHaveBeenCalled();
      expect(mockedSwagger.setup).not.toHaveBeenCalled();
    },
  );
});
