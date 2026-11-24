import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { es } from '../i18n/es';
import {
  ownerRole,
  ownerStaff,
  supportRole,
  supportStaff,
} from '../test/fixtures';
import { mockFetch } from '../test/fetchMock';
import { RolesScreen } from './RolesScreen';
import { StaffScreen } from './StaffScreen';

const permissions = [
  { key: 'users.read', description: 'Ver usuarios' },
  { key: 'staff.manage', description: 'Gestionar personal' },
  { key: 'roles.manage', description: 'Gestionar roles' },
];

describe('StaffScreen', () => {
  it('shows no edit or disable controls on the system (owner) row', async () => {
    mockFetch({
      'GET staff': { body: [ownerStaff, supportStaff] },
      'GET roles': { body: [ownerRole, supportRole] },
    });

    render(<StaffScreen />);

    const ownerRow = (await screen.findByText(ownerStaff.email)).closest('tr');
    const supportRow = screen.getByText(supportStaff.email).closest('tr');
    if (!ownerRow || !supportRow) throw new Error('rows not rendered');

    expect(within(ownerRow).queryAllByRole('button')).toHaveLength(0);
    expect(within(ownerRow).getByText(es.staff.owner)).toBeInTheDocument();
    expect(
      within(supportRow).getByRole('button', { name: es.staff.disable }),
    ).toBeInTheDocument();
  });

  it('never offers system roles in the invite role picker', async () => {
    mockFetch({
      'GET staff': { body: [ownerStaff] },
      'GET roles': { body: [ownerRole, supportRole] },
    });

    render(<StaffScreen />);

    const select = await screen.findByLabelText(es.staff.inviteRole);
    await screen.findByRole('option', { name: supportRole.name });
    const options = within(select)
      .getAllByRole('option')
      .map((option) => option.textContent);
    expect(options).toEqual([es.staff.chooseRole, supportRole.name]);
  });
});

describe('RolesScreen', () => {
  it('renders system roles read-only and owner-only permissions disabled', async () => {
    mockFetch({
      'GET roles': { body: [ownerRole, supportRole] },
      'GET permissions': { body: permissions },
    });

    render(<RolesScreen />);

    const ownerCard = (
      await screen.findByRole('heading', { name: ownerRole.name })
    ).closest('li');
    const supportCard = screen
      .getByRole('heading', { name: supportRole.name })
      .closest('li');
    if (!ownerCard || !supportCard) throw new Error('cards not rendered');

    expect(within(ownerCard).queryAllByRole('button')).toHaveLength(0);
    expect(within(ownerCard).getByText(es.roles.system)).toBeInTheDocument();
    expect(
      within(supportCard).getByRole('button', { name: es.roles.edit }),
    ).toBeInTheDocument();

    const staffManage = await screen.findByRole('checkbox', {
      name: /staff\.manage/,
    });
    expect(staffManage).toBeDisabled();
    expect(staffManage).toHaveAccessibleDescription(es.roles.ownerOnly);
    expect(
      screen.getByRole('checkbox', { name: /roles\.manage/ }),
    ).toBeDisabled();
    expect(screen.getByRole('checkbox', { name: /users\.read/ })).toBeEnabled();
  });
});
