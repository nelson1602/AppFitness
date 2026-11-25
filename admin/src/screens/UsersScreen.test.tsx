import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import type { UserSummary } from '../api/types';
import { es } from '../i18n/es';
import { makeMe } from '../test/fixtures';
import { mockFetch, urlOf } from '../test/fetchMock';
import { UsersScreen, localDay, nextSort } from './UsersScreen';

const emptyPage = { items: [], total: 0, page: 1, pageSize: 25 };
const EXPORTER = ['users.read', 'users.export'];
/** The list's default request: newest first. */
const DEFAULT_LIST = 'GET users?sort=createdAt&order=desc&page=1&pageSize=25';

const person: UserSummary = {
  id: 'user-1',
  email: 'ana@example.com',
  username: 'ana',
  createdAt: '2026-11-01T10:00:00.000Z',
  emailVerified: true,
  status: 'ACTIVE',
  lastLoginAt: null,
  deviceCount: 1,
  lastSyncAt: null,
  isPro: false,
};
const onePage = { items: [person], total: 1, page: 1, pageSize: 25 };

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

const listUrls = (calls: unknown[][]) =>
  calls
    .map(([input]) => urlOf(input as string))
    .filter((url) => url.startsWith('/admin/api/users'));

describe('UsersScreen sorting', () => {
  it('toggles the same column and starts another one ascending', () => {
    const start = { sort: 'createdAt', order: 'desc' } as const;
    expect(nextSort(start, 'createdAt')).toEqual({
      sort: 'createdAt',
      order: 'asc',
    });
    expect(nextSort(start, 'email')).toEqual({ sort: 'email', order: 'asc' });
    expect(nextSort({ sort: 'email', order: 'asc' }, 'email')).toEqual({
      sort: 'email',
      order: 'desc',
    });
  });

  it('makes every column header a sort toggle, sorted on the server', async () => {
    const user = userEvent.setup();
    const fetchMock = mockFetch({
      [DEFAULT_LIST]: { body: onePage },
      'GET users?sort=email&order=asc&page=1&pageSize=25': { body: onePage },
      'GET users?sort=email&order=desc&page=1&pageSize=25': { body: onePage },
      'GET users?sort=isPro&order=asc&page=1&pageSize=25': { body: onePage },
    });

    render(<UsersScreen me={makeMe(['users.read'])} />);
    await screen.findByText(es.users.resultCount(1));

    const labels = [
      es.users.email,
      es.users.username,
      es.users.status,
      es.users.verified,
      es.users.pro,
      es.users.devices,
      es.users.lastLogin,
      es.users.lastSync,
      es.users.createdAt,
    ];
    const headers = screen.getAllByRole('columnheader');
    expect(headers).toHaveLength(labels.length);
    for (const label of labels) {
      expect(screen.getByRole('button', { name: label })).toBeInTheDocument();
    }
    const headerOf = (label: string) =>
      screen.getByRole('button', { name: label }).closest('th');
    // Default: newest first.
    expect(headerOf(es.users.createdAt)).toHaveAttribute(
      'aria-sort',
      'descending',
    );
    expect(headerOf(es.users.email)).toHaveAttribute('aria-sort', 'none');

    await user.click(screen.getByRole('button', { name: es.users.email }));
    await waitFor(() =>
      expect(headerOf(es.users.email)).toHaveAttribute(
        'aria-sort',
        'ascending',
      ),
    );
    expect(headerOf(es.users.createdAt)).toHaveAttribute('aria-sort', 'none');

    await user.click(screen.getByRole('button', { name: es.users.email }));
    await waitFor(() =>
      expect(headerOf(es.users.email)).toHaveAttribute(
        'aria-sort',
        'descending',
      ),
    );

    await user.click(screen.getByRole('button', { name: es.users.pro }));
    await waitFor(() =>
      expect(headerOf(es.users.pro)).toHaveAttribute('aria-sort', 'ascending'),
    );

    expect(listUrls(fetchMock.mock.calls)).toEqual([
      '/admin/api/users?sort=createdAt&order=desc&page=1&pageSize=25',
      '/admin/api/users?sort=email&order=asc&page=1&pageSize=25',
      '/admin/api/users?sort=email&order=desc&page=1&pageSize=25',
      '/admin/api/users?sort=isPro&order=asc&page=1&pageSize=25',
    ]);
  });

  it('keeps the sort when searching, and back to page 1 when re-sorting', async () => {
    const user = userEvent.setup();
    const twoPages = { ...onePage, total: 30 };
    const fetchMock = mockFetch({
      [DEFAULT_LIST]: { body: twoPages },
      'GET users?sort=username&order=asc&page=1&pageSize=25': {
        body: twoPages,
      },
      'GET users?sort=username&order=asc&page=2&pageSize=25': {
        body: { ...twoPages, page: 2 },
      },
      'GET users?sort=username&order=desc&page=1&pageSize=25': {
        body: twoPages,
      },
      'GET users?q=ana&sort=username&order=desc&page=1&pageSize=25': {
        body: twoPages,
      },
    });

    render(<UsersScreen me={makeMe(['users.read'])} />);
    await screen.findByText(es.users.resultCount(30));
    await user.click(screen.getByRole('button', { name: es.users.username }));
    await waitFor(() => expect(listUrls(fetchMock.mock.calls)).toHaveLength(2));
    await user.click(screen.getByRole('button', { name: es.pagination.next }));
    await waitFor(() => expect(listUrls(fetchMock.mock.calls)).toHaveLength(3));
    await user.click(screen.getByRole('button', { name: es.users.username }));
    await waitFor(() => expect(listUrls(fetchMock.mock.calls)).toHaveLength(4));
    await user.type(screen.getByLabelText(es.users.searchLabel), 'ana');
    await user.click(screen.getByRole('button', { name: es.users.search }));
    await waitFor(() => expect(listUrls(fetchMock.mock.calls)).toHaveLength(5));

    expect(listUrls(fetchMock.mock.calls).slice(1)).toEqual([
      '/admin/api/users?sort=username&order=asc&page=1&pageSize=25',
      '/admin/api/users?sort=username&order=asc&page=2&pageSize=25',
      '/admin/api/users?sort=username&order=desc&page=1&pageSize=25',
      '/admin/api/users?q=ana&sort=username&order=desc&page=1&pageSize=25',
    ]);
  });
});

describe('UsersScreen export', () => {
  it('hides the export button with only users.read', async () => {
    mockFetch({ [DEFAULT_LIST]: { body: emptyPage } });

    render(<UsersScreen me={makeMe(['users.read'])} />);
    await screen.findByText(es.users.resultCount(0));

    expect(
      screen.queryByRole('button', { name: es.users.exportCsv }),
    ).not.toBeInTheDocument();
    expect(screen.queryByText(es.users.exportNote)).not.toBeInTheDocument();
  });

  it('shows the export button with users.export', async () => {
    mockFetch({ [DEFAULT_LIST]: { body: emptyPage } });

    render(<UsersScreen me={makeMe(EXPORTER)} />);
    await screen.findByText(es.users.resultCount(0));

    expect(
      screen.getByRole('button', { name: es.users.exportCsv }),
    ).toBeEnabled();
  });

  it('downloads the CSV with the applied filters and sort, and revokes the object URL', async () => {
    const user = userEvent.setup();
    const fetchMock = mockFetch({
      [DEFAULT_LIST]: { body: onePage },
      'GET users?q=ana&status=SUSPENDED&sort=createdAt&order=desc&page=1&pageSize=25':
        { body: onePage },
      'GET users?q=ana&status=SUSPENDED&sort=email&order=asc&page=1&pageSize=25':
        { body: onePage },
      'GET export/users.csv?q=ana&status=SUSPENDED&sort=email&order=asc': {
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
    await screen.findByText(es.users.resultCount(1));
    await user.click(screen.getByRole('button', { name: es.users.email }));
    await waitFor(() => expect(listUrls(fetchMock.mock.calls)).toHaveLength(3));

    await user.click(screen.getByRole('button', { name: es.users.exportCsv }));

    await waitFor(() =>
      expect(revokeObjectURL).toHaveBeenCalledWith('blob:mock-1'),
    );
    const csvCall = fetchMock.mock.calls.find(([input]) =>
      urlOf(input).includes('export/users.csv'),
    );
    expect(urlOf(csvCall?.[0] ?? '')).toBe(
      '/admin/api/export/users.csv?q=ana&status=SUSPENDED&sort=email&order=asc',
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
      [DEFAULT_LIST]: { body: emptyPage },
      'GET export/users.csv?sort=createdAt&order=desc': {
        status: 403,
        body: { statusCode: 403 },
      },
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
        ([input]) =>
          urlOf(input) ===
          '/admin/api/export/users.csv?sort=createdAt&order=desc',
      ),
    ).toBe(true);
    expect(createObjectURL).not.toHaveBeenCalled();
  });

  it('disables the button while the download is in flight', async () => {
    const user = userEvent.setup();
    let release: (() => void) | undefined;
    mockFetch({ [DEFAULT_LIST]: { body: emptyPage } });
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
