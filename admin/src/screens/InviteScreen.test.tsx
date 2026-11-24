import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { es } from '../i18n/es';
import { bodyOfCall, mockFetch } from '../test/fetchMock';
import { InviteScreen } from './InviteScreen';

const TOKEN = 'tok_ABC123secret';

describe('InviteScreen', () => {
  it('reads the token, strips it from the address bar and inspects it', async () => {
    window.history.replaceState(null, '', `/admin/#/invitacion?token=${TOKEN}`);
    const fetchMock = mockFetch({
      'POST invites/inspect': { body: { email: 'nuevo@appfitness.test' } },
    });

    render(<InviteScreen />);

    expect(window.location.href).not.toContain(TOKEN);
    expect(window.location.hash).toBe('#/invitacion');
    expect(
      await screen.findByText(es.invite.forEmail('nuevo@appfitness.test')),
    ).toBeInTheDocument();
    expect(bodyOfCall(fetchMock.mock.calls, 'invites/inspect')).toEqual({
      token: TOKEN,
    });
  });

  it('walks password → enrollment → confirmation', async () => {
    const user = userEvent.setup();
    window.history.replaceState(null, '', `/admin/#/invitacion?token=${TOKEN}`);
    const fetchMock = mockFetch({
      'POST invites/inspect': { body: { email: 'nuevo@appfitness.test' } },
      'POST invites/accept': {
        body: {
          totpSecret: 'JBSWY3DPEHPK3PXPJBSWY3DP',
          otpauthUri: 'otpauth://totp/AppFitness:nuevo?secret=JBSWY3DPEHPK3PXP',
        },
      },
      'POST invites/confirm': { status: 204 },
    });

    render(<InviteScreen />);

    await user.type(await screen.findByLabelText(es.invite.password), 'short');
    await user.type(screen.getByLabelText(es.invite.passwordConfirm), 'short');
    await user.click(
      screen.getByRole('button', { name: es.invite.passwordSubmit }),
    );
    expect(screen.getByRole('alert')).toHaveTextContent(
      es.invite.passwordTooShort,
    );

    await user.clear(screen.getByLabelText(es.invite.password));
    await user.clear(screen.getByLabelText(es.invite.passwordConfirm));
    await user.type(
      screen.getByLabelText(es.invite.password),
      'una frase bastante larga',
    );
    await user.type(
      screen.getByLabelText(es.invite.passwordConfirm),
      'una frase bastante larga',
    );
    await user.click(
      screen.getByRole('button', { name: es.invite.passwordSubmit }),
    );

    expect(
      await screen.findByText('JBSW Y3DP EHPK 3PXP JBSW Y3DP'),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('link', { name: es.invite.openApp }),
    ).toHaveAttribute('href', expect.stringMatching(/^otpauth:\/\//));

    await user.type(screen.getByLabelText(es.invite.codeLabel), '123456');
    await user.click(
      screen.getByRole('button', { name: es.invite.confirmSubmit }),
    );

    expect(
      await screen.findByRole('heading', { name: es.invite.doneTitle }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('link', { name: es.invite.goToLogin }),
    ).toHaveAttribute('href', '#/login');
    expect(bodyOfCall(fetchMock.mock.calls, 'invites/confirm')).toEqual({
      token: TOKEN,
      code: '123456',
    });
  });

  it('shows an error when the token is missing', () => {
    window.history.replaceState(null, '', '/admin/#/invitacion');
    mockFetch({});
    render(<InviteScreen />);
    expect(screen.getByRole('alert')).toHaveTextContent(es.invite.missingToken);
  });
});
