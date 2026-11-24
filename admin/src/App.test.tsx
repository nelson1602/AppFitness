import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { App } from './App';
import { es } from './i18n/es';
import { makeMe } from './test/fixtures';
import { bodyOfCall, mockFetch } from './test/fetchMock';

const dashboard = {
  totalUsers: 10,
  newPerDay: [{ date: '2026-11-20', count: 3 }],
  verifiedPct: 50,
  active7d: 4,
  proCount: 1,
};

describe('App', () => {
  it('shows the login screen when there is no session (401 on /auth/me)', async () => {
    mockFetch({ 'GET auth/me': { status: 401, body: { statusCode: 401 } } });

    render(<App />);

    expect(
      await screen.findByRole('heading', { name: es.login.title }),
    ).toBeInTheDocument();
  });

  it('runs the email/password → TOTP two-step login', async () => {
    const user = userEvent.setup();
    const me = makeMe(['metrics.read']);
    const fetchMock = mockFetch({
      'GET auth/me': { status: 401, body: { statusCode: 401 } },
      'POST auth/login': { body: { stage: 'mfa' } },
      'POST auth/totp': { body: me },
      'GET metrics/dashboard': { body: dashboard },
    });

    render(<App />);
    await user.type(await screen.findByLabelText(es.login.email), me.email);
    await user.type(screen.getByLabelText(es.login.password), 'correct horse');
    await user.click(screen.getByRole('button', { name: es.login.submit }));

    const code = await screen.findByLabelText(es.login.totpCode);
    expect(
      screen.getByRole('heading', { name: es.login.totpTitle }),
    ).toBeInTheDocument();
    await user.type(code, '123456');
    await user.click(screen.getByRole('button', { name: es.login.totpSubmit }));

    expect(
      await screen.findByRole('heading', {
        name: es.dashboard.title,
        level: 1,
      }),
    ).toBeInTheDocument();
    expect(screen.getByText(me.email)).toBeInTheDocument();

    expect(bodyOfCall(fetchMock.mock.calls, 'auth/login')).toEqual({
      email: me.email,
      password: 'correct horse',
    });
    expect(bodyOfCall(fetchMock.mock.calls, 'auth/totp')).toEqual({
      code: '123456',
    });
  });

  it('returns to the email/password step when the TOTP code is rejected', async () => {
    const user = userEvent.setup();
    mockFetch({
      'GET auth/me': { status: 401, body: { statusCode: 401 } },
      'POST auth/login': { body: { stage: 'mfa' } },
      'POST auth/totp': { status: 401, body: { statusCode: 401 } },
    });

    render(<App />);
    await user.type(await screen.findByLabelText(es.login.email), 'a@b.test');
    await user.type(screen.getByLabelText(es.login.password), 'pw');
    await user.click(screen.getByRole('button', { name: es.login.submit }));
    await user.type(await screen.findByLabelText(es.login.totpCode), '000000');
    await user.click(screen.getByRole('button', { name: es.login.totpSubmit }));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      es.login.totpInvalid,
    );
    expect(screen.getByLabelText(es.login.password)).toBeInTheDocument();
  });

  it('hides nav items the staff member has no permission for', async () => {
    mockFetch({
      'GET auth/me': { body: makeMe(['users.read', 'audit.read']) },
      'GET users?q=&status=&page=1&pageSize=25': {
        body: { items: [], total: 0, page: 1, pageSize: 25 },
      },
      'GET users?page=1&pageSize=25': {
        body: { items: [], total: 0, page: 1, pageSize: 25 },
      },
    });

    render(<App />);

    const nav = await screen.findByRole('navigation', { name: es.nav.label });
    const links = within(nav)
      .getAllByRole('link')
      .map((link) => link.textContent);
    expect(links).toEqual([es.nav.users, es.nav.audit]);
    expect(
      within(nav).queryByRole('link', { name: es.nav.dashboard }),
    ).not.toBeInTheDocument();
    expect(
      within(nav).queryByRole('link', { name: es.nav.staff }),
    ).not.toBeInTheDocument();
    expect(
      within(nav).queryByRole('link', { name: es.nav.roles }),
    ).not.toBeInTheDocument();
    // Lands on the first permitted section.
    expect(
      await screen.findByRole('heading', { name: es.users.title, level: 1 }),
    ).toBeInTheDocument();
  });

  it('routes to the login screen when a later call answers 401', async () => {
    window.location.hash = '#/panel';
    mockFetch({
      'GET auth/me': { body: makeMe(['metrics.read']) },
      'GET metrics/dashboard': { status: 401, body: { statusCode: 401 } },
    });

    render(<App />);

    expect(
      await screen.findByRole('heading', { name: es.login.title }),
    ).toBeInTheDocument();
    expect(window.location.hash).toBe('#/login');
    expect(screen.getByRole('alert')).toHaveTextContent(
      es.errors.sessionExpired,
    );
  });
});
