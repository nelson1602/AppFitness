import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { es } from '../i18n/es';
import { makeMe, userDetail } from '../test/fixtures';
import { countCalls, mockFetch } from '../test/fetchMock';
import { DeleteUserDialog, UserDetailScreen } from './UserDetailScreen';

const copy = es.userDetail.actions.delete;

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
