import { fireEvent, render, screen } from '@testing-library/react-native';
import type { BottomTabHeaderProps } from 'expo-router/tabs';
import { Platform } from 'react-native';

import type { AppNotification } from '@/features/notifications';

import { AppHeader } from './app-header';
import { notificationTime } from './notification-list';

let mockLanguage: 'en' | 'es' = 'en';
let mockNotifications: AppNotification[] = [];
let mockReadIds: string[] = [];
const mockMarkRead = jest.fn();

jest.mock('expo-router', () => ({ router: { navigate: jest.fn() } }));
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 20, bottom: 0, left: 0, right: 0 }),
}));
jest.mock('@/features/authentication', () => ({
  useSession: () => ({
    status: 'authenticated',
    session: { user: { id: 'user-1', username: 'Nelson' } },
  }),
}));
jest.mock('@/features/dashboard/application/use-home-data', () => ({
  useHomeData: () => ({ summary: null, notifications: mockNotifications }),
}));
jest.mock('@/features/notifications/application/notifications.store', () => ({
  useNotificationsStore: (
    select: (state: { readIds: string[]; markRead: typeof mockMarkRead }) => unknown,
  ) => select({ readIds: mockReadIds, markRead: mockMarkRead }),
}));
jest.mock('@/shared/localization', () => {
  const actual = jest.requireActual('@/shared/localization');
  const { en } = jest.requireActual('@/shared/localization/resources/en');
  const { es } = jest.requireActual('@/shared/localization/resources/es');
  return {
    ...actual,
    useLocalization: () => ({
      language: mockLanguage,
      t: (key: keyof typeof en) => (mockLanguage === 'es' ? es[key] : en[key]),
    }),
  };
});

const TODAY: AppNotification = {
  id: 'today-training:2026-10-23',
  kind: 'today-training',
  target: 'workouts',
  ageDays: 0,
};
const WEIGH: AppNotification = {
  id: 'weigh-in:2026-10-19',
  kind: 'weigh-in',
  target: 'progress',
  ageDays: 9,
};

function header(name: string) {
  return { route: { key: `${name}-key`, name } } as unknown as BottomTabHeaderProps;
}

function navigate() {
  return jest.requireMock<{ router: { navigate: jest.Mock } }>('expo-router').router.navigate;
}

beforeEach(() => {
  jest.clearAllMocks();
  mockLanguage = 'en';
  mockNotifications = [TODAY, WEIGH];
  mockReadIds = [];
});

describe('AppHeader (ADR-P039)', () => {
  it('greets the person by name on Inicio, under the date', async () => {
    mockLanguage = 'es';
    await render(<AppHeader {...header('dashboard')} />);

    expect(screen.getByRole('header', { name: 'Hola, Nelson' })).toBeOnTheScreen();
  });

  it('names the tab on every other tab', async () => {
    await render(<AppHeader {...header('progress')} />);

    expect(screen.getByRole('header', { name: 'Progress' })).toBeOnTheScreen();
  });

  it('counts the unread notifications in the bell, in words and as a badge', async () => {
    mockReadIds = [WEIGH.id];
    await render(<AppHeader {...header('dashboard')} />);

    expect(screen.getByRole('button', { name: 'Notifications, 1 unread' })).toBeOnTheScreen();
    // The badge is hidden from assistive technology: the bell's name says it.
    expect(
      screen.getByTestId('header-bell-badge', { includeHiddenElements: true }),
    ).toHaveTextContent('1');
  });

  it('shows no badge once everything is read', async () => {
    mockReadIds = [TODAY.id, WEIGH.id];
    await render(<AppHeader {...header('dashboard')} />);

    expect(screen.getByRole('button', { name: 'Notifications, 0 unread' })).toBeOnTheScreen();
    expect(screen.queryByTestId('header-bell-badge', { includeHiddenElements: true })).toBeNull();
  });

  it('has no bell on Web, where the read state cannot be stored (D2)', async () => {
    const os = jest.replaceProperty(Platform, 'OS', 'web');
    await render(<AppHeader {...header('dashboard')} />);

    expect(screen.queryByTestId('header-bell')).toBeNull();
    os.restore();
  });
});

describe('NotificationList (ADR-P039 D4)', () => {
  async function open() {
    await render(<AppHeader {...header('dashboard')} />);
    await fireEvent.press(screen.getByTestId('header-bell'));
  }

  it('lists each notification with its unread state spoken, not only shown', async () => {
    mockReadIds = [WEIGH.id];
    await open();

    expect(screen.getByRole('header', { name: 'Notifications' })).toBeOnTheScreen();
    const unread = screen.getByTestId('notification-today-training');
    expect(unread.props.accessibilityHint).toBe('Unread');
    expect(
      screen.getByTestId('notification-today-training-unread', { includeHiddenElements: true }),
    ).toBeOnTheScreen();
    const read = screen.getByTestId('notification-weigh-in');
    expect(read.props.accessibilityHint).toBeUndefined();
    expect(
      screen.queryByTestId('notification-weigh-in-unread', { includeHiddenElements: true }),
    ).toBeNull();
  });

  it('opens the notification’s tab and marks it read', async () => {
    await open();
    await fireEvent.press(screen.getByTestId('notification-weigh-in'));

    expect(mockMarkRead).toHaveBeenCalledWith([WEIGH.id]);
    expect(navigate()).toHaveBeenCalledWith('/progress');
    expect(screen.queryByTestId('notifications-list')).toBeNull();
  });

  it("marks every unread one read with 'Mark all as read'", async () => {
    await open();
    await fireEvent.press(screen.getByTestId('notifications-mark-all'));

    expect(mockMarkRead).toHaveBeenCalledWith([TODAY.id, WEIGH.id]);
    expect(navigate()).not.toHaveBeenCalled();
  });

  it("offers no 'Mark all as read' when nothing is unread, and closes", async () => {
    mockReadIds = [TODAY.id, WEIGH.id];
    await open();

    expect(screen.queryByTestId('notifications-mark-all')).toBeNull();
    await fireEvent.press(screen.getByTestId('notifications-close'));
    expect(screen.queryByTestId('notifications-list')).toBeNull();
  });

  it('dates each notification like the design (Hoy, Hace N días), in Spanish', async () => {
    mockLanguage = 'es';
    await open();

    expect(screen.getByTestId('notification-today-training-time')).toHaveTextContent('Hoy');
    expect(screen.getByTestId('notification-weigh-in-time')).toHaveTextContent('Hace 9 días');
    expect(screen.getByTestId('notification-weigh-in').props.accessibilityLabel).toBe(
      'Registra tu peso. Hace 9 días. Pésate en ayunas para ver tu progreso de la semana.',
    );
  });

  it('says so when there is nothing, in Spanish', async () => {
    mockLanguage = 'es';
    mockNotifications = [];
    await open();

    expect(screen.getByText('No tienes notificaciones.')).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Cerrar' })).toBeOnTheScreen();
  });
});

describe('notificationTime', () => {
  const { es } = jest.requireActual('@/shared/localization/resources/es');
  const t = (key: keyof typeof es) => es[key];

  it.each([
    [0, 'Hoy'],
    [1, 'Ayer'],
    [12, 'Hace 12 días'],
    [null, null],
  ] as const)('words %s days as %s', (ageDays, expected) => {
    expect(notificationTime(ageDays, t, 'es')).toBe(expected);
  });
});
