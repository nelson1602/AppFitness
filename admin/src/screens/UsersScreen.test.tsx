import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { es } from '../i18n/es';
import { makeMe } from '../test/fixtures';
import { mockFetch, urlOf } from '../test/fetchMock';
import { UsersScreen, localDay } from './UsersScreen';

const emptyPage = { items: [], total: 0, page: 1, pageSize: 25 };
const EXPORTER = ['users.read', 'users.export'];

function stubObjectUrls() {
  const createObjectURL = vi.fn((object: Blob | MediaSource): string => {
    void object;
    return 'blob:mock-1';
  });
  const revokeObjectURL = vi.fn();
  // jsdom has no object URLs; a subclass keeps `new URL()` working and is
  // undone by `vi.unstubAllGlobals()` in the shared setup.
  class MockUrl extends URL {
    static override createObjectURL = createObjectURL;
    static override revokeObjectURL = revokeObjectURL;
  }
  vi.stubGlobal('URL', MockUrl);
  return { createObjectURL, revokeObjectURL };
}

describe('UsersScreen export', () => {
  it('hides the export button with only users.read', async () => {
    mockFetch({ 'GET users?page=1&pageSize=25': { body: emptyPage } });

    render(<UsersScreen me={makeMe(['users.read'])} />);
    await screen.findByText(es.users.resultCount(0));

    expect(
      screen.queryByRole('button', { name: es.users.exportCsv }),
    ).not.toBeInTheDocument();
    expect(screen.queryByText(es.users.exportNote)).not.toBeInTheDocument();
  });

  it('shows the export button with users.export', async () => {
    mockFetch({ 'GET users?page=1&pageSize=25': { body: emptyPage } });

    render(<UsersScreen me={makeMe(EXPORTER)} />);
    await screen.findByText(es.users.resultCount(0));

    expect(
      screen.getByRole('button', { name: es.users.exportCsv }),
    ).toBeEnabled();
  });

  it('downloads the CSV with the applied filters and revokes the object URL', async () => {
    const user = userEvent.setup();
    const fetchMock = mockFetch({
      'GET users?page=1&pageSize=25': { body: emptyPage },
      'GET users?q=ana&status=SUSPENDED&page=1&pageSize=25': {
        body: emptyPage,
      },
      'GET export/users.csv?q=ana&status=SUSPENDED': {
        body: 'id,email\n1,ana@example.com\n',
      },
    });
    const { createObjectURL, revokeObjectURL } = stubObjectUrls();
    const clicked: { href: string; download: string }[] = [];
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (
      this: HTMLAnchorElement,
    ) {
      clicked.push({ href: this.href, download: this.download });
    });

    render(<UsersScreen me={makeMe(EXPORTER)} />);

    expect(screen.getByText(es.users.exportNote)).toBeInTheDocument();
    await user.type(screen.getByLabelText(es.users.searchLabel), 'ana');
    await user.selectOptions(
      screen.getByLabelText(es.users.statusLabel),
      'SUSPENDED',
    );
    await user.click(screen.getByRole('button', { name: es.users.search }));
    await screen.findByText(es.users.resultCount(0));

    await user.click(screen.getByRole('button', { name: es.users.exportCsv }));

    await waitFor(() =>
      expect(revokeObjectURL).toHaveBeenCalledWith('blob:mock-1'),
    );
    const csvCall = fetchMock.mock.calls.find(([input]) =>
      urlOf(input).includes('export/users.csv'),
    );
    expect(urlOf(csvCall?.[0] ?? '')).toBe(
      '/admin/api/export/users.csv?q=ana&status=SUSPENDED',
    );
    expect(csvCall?.[1]?.credentials).toBe('same-origin');
    expect(createObjectURL).toHaveBeenCalledTimes(1);
    expect(createObjectURL.mock.calls[0]?.[0]).toBeInstanceOf(Blob);
    expect(clicked).toEqual([
      {
        href: 'blob:mock-1',
        download: es.users.exportFileName(localDay(new Date())),
      },
    ]);
    expect(clicked[0]?.download).toMatch(/^usuarios-\d{4}-\d{2}-\d{2}\.csv$/);
    expect(
      screen.getByRole('button', { name: es.users.exportCsv }),
    ).toBeEnabled();
  });

  it('omits empty filters and shows an error banner when the export fails', async () => {
    const user = userEvent.setup();
    const fetchMock = mockFetch({
      'GET users?page=1&pageSize=25': { body: emptyPage },
      'GET export/users.csv': { status: 403, body: { statusCode: 403 } },
    });
    const { createObjectURL } = stubObjectUrls();

    render(<UsersScreen me={makeMe(EXPORTER)} />);
    await screen.findByText(es.users.resultCount(0));
    await user.click(screen.getByRole('button', { name: es.users.exportCsv }));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      es.users.exportFailed(es.errors.forbidden),
    );
    expect(
      fetchMock.mock.calls.some(
        ([input]) => urlOf(input) === '/admin/api/export/users.csv',
      ),
    ).toBe(true);
    expect(createObjectURL).not.toHaveBeenCalled();
  });

  it('disables the button while the download is in flight', async () => {
    const user = userEvent.setup();
    let release: (() => void) | undefined;
    mockFetch({ 'GET users?page=1&pageSize=25': { body: emptyPage } });
    const listFetch = globalThis.fetch;
    vi.stubGlobal(
      'fetch',
      vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
        if (urlOf(input).includes('export/users.csv')) {
          return new Promise<Response>((resolve) => {
            release = () => resolve(new Response('id\n', { status: 200 }));
          });
        }
        return listFetch(input, init);
      }),
    );
    stubObjectUrls();
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(
      () => undefined,
    );

    render(<UsersScreen me={makeMe(EXPORTER)} />);
    await screen.findByText(es.users.resultCount(0));
    await user.click(screen.getByRole('button', { name: es.users.exportCsv }));

    expect(
      screen.getByRole('button', { name: es.users.exporting }),
    ).toBeDisabled();
    release?.();
    expect(
      await screen.findByRole('button', { name: es.users.exportCsv }),
    ).toBeEnabled();
  });
});
