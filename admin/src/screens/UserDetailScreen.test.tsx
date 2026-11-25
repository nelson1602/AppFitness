import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { es } from '../i18n/es';
import { makeMe, userDetail } from '../test/fixtures';
import { bodyOfCall, countCalls, mockFetch } from '../test/fetchMock';
import type { SubscriptionMirror, UserSubscription } from '../api/types';
import { DeleteUserDialog, UserDetailScreen } from './UserDetailScreen';

const copy = es.userDetail.actions.delete;
const sub = es.userDetail.subscription;

const mirror: SubscriptionMirror = {
  state: 'INACTIVE',
  expiresAt: null,
  periodType: null,
  store: null,
  willRenew: null,
  lastReconciledAt: null,
};

const noProvider: UserSubscription = {
  mirror,
  provider: { available: false, snapshot: null },
};

const withProvider: UserSubscription = {
  mirror: {
    ...mirror,
    state: 'ACTIVE',
    expiresAt: '2026-12-24T10:00:00.000Z',
    store: 'PROMOTIONAL',
  },
  provider: {
    available: true,
    snapshot: {
      entitlementId: 'pro',
      isActive: true,
      expiresAt: '2026-12-24T10:00:00.000Z',
      periodType: 'normal',
      productId: 'rc_promo_pro_monthly',
      store: 'promotional',
      environment: 'production',
      willRenew: false,
    },
  },
};

describe('UserDetailScreen subscription', () => {
  it('is hidden without subscriptions.read', async () => {
    const fetchMock = mockFetch({ 'GET users/user-1': { body: userDetail } });

    render(<UserDetailScreen me={makeMe(['users.read'])} userId="user-1" />);

    expect(
      await screen.findByRole('heading', { name: es.userDetail.summary }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('heading', { name: sub.title }),
    ).not.toBeInTheDocument();
    expect(countCalls(fetchMock.mock.calls, 'users/user-1/subscription')).toBe(
      0,
    );
  });

  it('shows the state read-only without subscriptions.grant', async () => {
    mockFetch({
      'GET users/user-1': { body: userDetail },
      'GET users/user-1/subscription': { body: noProvider },
    });

    render(
      <UserDetailScreen
        me={makeMe(['users.read', 'subscriptions.read'])}
        userId="user-1"
      />,
    );

    expect(
      await screen.findByText(sub.providerUnavailable),
    ).toBeInTheDocument();
    expect(screen.getByText(sub.states.INACTIVE)).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: sub.grant.button }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: sub.revoke.button }),
    ).not.toBeInTheDocument();
    expect(screen.queryByLabelText(sub.durationLabel)).not.toBeInTheDocument();
  });

  it('grants the chosen duration after confirmation and refetches', async () => {
    const user = userEvent.setup();
    let subscription = noProvider;
    const fetchMock = mockFetch({
      'GET users/user-1': { body: userDetail },
      'GET users/user-1/subscription': () => ({ body: subscription }),
      'POST users/user-1/subscription/promotional': () => {
        subscription = withProvider;
        return { body: withProvider.mirror };
      },
    });

    render(
      <UserDetailScreen
        me={makeMe(['users.read', 'subscriptions.read', 'subscriptions.grant'])}
        userId="user-1"
      />,
    );

    await user.selectOptions(
      await screen.findByLabelText(sub.durationLabel),
      'three_month',
    );
    await user.click(screen.getByRole('button', { name: sub.grant.button }));
    const dialog = screen.getByRole('dialog', { name: sub.grant.title });
    expect(dialog).toHaveTextContent(sub.durations.three_month);
    expect(countCalls(fetchMock.mock.calls, 'subscription/promotional')).toBe(
      0,
    );
    await user.click(
      within(dialog).getByRole('button', { name: sub.grant.confirm }),
    );

    expect(await screen.findByRole('status')).toHaveTextContent(
      sub.grant.success,
    );
    expect(
      bodyOfCall(fetchMock.mock.calls, 'subscription/promotional'),
    ).toEqual({ duration: 'three_month' });
    expect(await screen.findByText(sub.states.ACTIVE)).toBeInTheDocument();
    expect(screen.getByText('rc_promo_pro_monthly')).toBeInTheDocument();
    expect(countCalls(fetchMock.mock.calls, 'users/user-1/subscription')).toBe(
      2,
    );
  });

  it('explains a 503 when revoking', async () => {
    const user = userEvent.setup();
    mockFetch({
      'GET users/user-1': { body: userDetail },
      'GET users/user-1/subscription': { body: noProvider },
      'POST users/user-1/subscription/revoke-promotional': {
        status: 503,
        body: { statusCode: 503 },
      },
    });

    render(
      <UserDetailScreen
        me={makeMe(['users.read', 'subscriptions.read', 'subscriptions.grant'])}
        userId="user-1"
      />,
    );

    await user.click(
      await screen.findByRole('button', { name: sub.revoke.button }),
    );
    await user.click(
      within(screen.getByRole('dialog', { name: sub.revoke.title })).getByRole(
        'button',
        { name: sub.revoke.confirm },
      ),
    );

    expect(await screen.findByRole('alert')).toHaveTextContent(
      sub.providerRefused,
    );
  });
});

describe('DeleteUserDialog', () => {
  it('keeps the delete button disabled until the exact email is typed', async () => {
    const user = userEvent.setup();
    const onConfirm = vi.fn();
    render(
      <DeleteUserDialog
        email="persona@example.com"
        busy={false}
        onCancel={vi.fn()}
        onConfirm={onConfirm}
      />,
    );

    const dialog = screen.getByRole('dialog', { name: copy.title });
    expect(dialog).toHaveTextContent('PERMANENTE');
    const button = screen.getByRole('button', { name: copy.confirm });
    const input = screen.getByLabelText(copy.typeEmailLabel);
    expect(button).toBeDisabled();

    await user.type(input, 'persona@example.co');
    expect(button).toBeDisabled();

    await user.type(input, 'M');
    expect(button).toBeDisabled();

    await user.clear(input);
    await user.type(input, 'persona@example.com');
    expect(button).toBeEnabled();

    await user.click(button);
    expect(onConfirm).toHaveBeenCalledWith('persona@example.com');
  });

  it('closes on Escape', async () => {
    const user = userEvent.setup();
    const onCancel = vi.fn();
    render(
      <DeleteUserDialog
        email="persona@example.com"
        busy={false}
        onCancel={onCancel}
        onConfirm={vi.fn()}
      />,
    );
    await user.keyboard('{Escape}');
    expect(onCancel).toHaveBeenCalled();
  });
});

describe('UserDetailScreen', () => {
  it('shows only the actions the staff member is allowed to run', async () => {
    mockFetch({ 'GET users/user-1': { body: userDetail } });

    render(
      <UserDetailScreen
        me={makeMe(['users.read', 'users.support'])}
        userId="user-1"
      />,
    );

    expect(
      await screen.findByRole('button', {
        name: es.userDetail.actions.sendPasswordReset.button,
      }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('button', {
        name: es.userDetail.actions.suspend.button,
      }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: copy.button }),
    ).not.toBeInTheDocument();
  });

  it('confirms an action, shows a success banner and refetches the user', async () => {
    const user = userEvent.setup();
    const fetchMock = mockFetch({
      'GET users/user-1': { body: userDetail },
      'POST users/user-1/suspend': { status: 204 },
    });

    render(
      <UserDetailScreen
        me={makeMe(['users.read', 'users.suspend'])}
        userId="user-1"
      />,
    );

    await user.click(
      await screen.findByRole('button', {
        name: es.userDetail.actions.suspend.button,
      }),
    );
    const dialog = screen.getByRole('dialog', {
      name: es.userDetail.actions.suspend.title,
    });
    await user.click(
      within(dialog).getByRole('button', {
        name: es.userDetail.actions.suspend.confirm,
      }),
    );

    expect(await screen.findByRole('status')).toHaveTextContent(
      es.userDetail.actions.suspend.success,
    );
    await waitFor(() =>
      expect(countCalls(fetchMock.mock.calls, 'users/user-1')).toBe(2),
    );
  });
});
