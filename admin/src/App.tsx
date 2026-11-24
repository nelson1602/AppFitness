import { useCallback, useEffect, useState } from 'react';
import type { MouseEvent, ReactNode } from 'react';
import { ApiError, errorMessage, setUnauthorizedHandler } from './api/client';
import { authApi } from './api/endpoints';
import type { Me, Permission } from './api/types';
import { ErrorText, Loading } from './components/Banner';
import { es } from './i18n/es';
import { can, visibleNav } from './permissions';
import { href, navigate, parseHash, paths, useHash } from './router';
import { AuditScreen } from './screens/AuditScreen';
import { ConfigScreen } from './screens/ConfigScreen';
import { DashboardScreen } from './screens/DashboardScreen';
import { InviteScreen } from './screens/InviteScreen';
import { LoginScreen } from './screens/LoginScreen';
import { RolesScreen } from './screens/RolesScreen';
import { StaffScreen } from './screens/StaffScreen';
import { UserDetailScreen } from './screens/UserDetailScreen';
import { UsersScreen } from './screens/UsersScreen';

type AuthState =
  | { status: 'loading' }
  | { status: 'anonymous'; notice: string | null }
  | { status: 'error'; message: string }
  | { status: 'authenticated'; me: Me };

const INVITE_SEGMENT = paths.invite.slice(1);
const LOGIN_SEGMENT = paths.login.slice(1);

function isInviteRoute(hash: string): boolean {
  return parseHash(hash).segments[0] === INVITE_SEGMENT;
}

export function App() {
  const hash = useHash();
  const route = parseHash(hash);
  const onInvite = route.segments[0] === INVITE_SEGMENT;

  const [auth, setAuth] = useState<AuthState>(() =>
    isInviteRoute(window.location.hash)
      ? { status: 'anonymous', notice: null }
      : { status: 'loading' },
  );

  // Any 401 on a session-protected call sends the person to the login screen.
  useEffect(() => {
    setUnauthorizedHandler(() => {
      setAuth({ status: 'anonymous', notice: es.errors.sessionExpired });
      if (!isInviteRoute(window.location.hash)) navigate(paths.login);
    });
    return () => setUnauthorizedHandler(null);
  }, []);

  // Restore an existing session (HttpOnly cookie) on first load.
  useEffect(() => {
    if (isInviteRoute(window.location.hash)) return;
    let active = true;
    authApi.me().then(
      (me) => {
        if (active) setAuth({ status: 'authenticated', me });
      },
      (err: unknown) => {
        if (!active) return;
        if (err instanceof ApiError && err.status === 401) {
          setAuth({ status: 'anonymous', notice: null });
        } else {
          setAuth({ status: 'error', message: errorMessage(err) });
        }
      },
    );
    return () => {
      active = false;
    };
  }, []);

  const me = auth.status === 'authenticated' ? auth.me : null;
  const home = visibleNav(me)[0]?.path ?? null;
  const segment = route.segments[0] ?? '';

  // Land on the first permitted section after login or on an empty route.
  useEffect(() => {
    if (!me || onInvite) return;
    if ((segment === '' || segment === LOGIN_SEGMENT) && home) navigate(home);
  }, [me, onInvite, segment, home]);

  const onLoggedIn = useCallback((next: Me) => {
    setAuth({ status: 'authenticated', me: next });
  }, []);

  const onLogout = useCallback(async () => {
    try {
      await authApi.logout();
    } catch (err) {
      // The local view is cleared either way; the server cookie expires on
      // its own. Surface the failure in the console for debugging only.
      console.warn('logout failed', err instanceof ApiError ? err.status : err);
    }
    setAuth({ status: 'anonymous', notice: null });
    navigate(paths.login);
  }, []);

  if (onInvite) return <InviteScreen />;

  if (auth.status === 'loading') {
    return (
      <main id="main" className="auth-page">
        <Loading />
      </main>
    );
  }

  if (auth.status === 'error') {
    return (
      <main id="main" className="auth-page">
        <div className="auth-card">
          <ErrorText>{auth.message}</ErrorText>
          <button
            type="button"
            className="button button--primary"
            onClick={() => window.location.reload()}
          >
            {es.common.retry}
          </button>
        </div>
      </main>
    );
  }

  if (auth.status === 'anonymous') {
    return <LoginScreen onLoggedIn={onLoggedIn} notice={auth.notice} />;
  }

  return (
    <Shell me={auth.me} currentPath={`/${segment}`} onLogout={onLogout}>
      <Routes me={auth.me} segments={route.segments} hasHome={home !== null} />
    </Shell>
  );
}

function Routes({
  me,
  segments,
  hasHome,
}: {
  me: Me;
  segments: string[];
  hasHome: boolean;
}) {
  const [first = '', second] = segments;

  const guard = (permission: Permission, screen: ReactNode) =>
    can(me, permission) ? screen : <Forbidden />;

  switch (`/${first}`) {
    case '/':
    case paths.login:
      return hasHome ? <Loading /> : <p>{es.app.noAccess}</p>;
    case paths.dashboard:
      return guard('metrics.read', <DashboardScreen />);
    case paths.users:
      return guard(
        'users.read',
        second ? (
          <UserDetailScreen key={second} me={me} userId={second} />
        ) : (
          <UsersScreen me={me} />
        ),
      );
    case paths.staff:
      return guard('staff.manage', <StaffScreen />);
    case paths.roles:
      return guard('roles.manage', <RolesScreen />);
    case paths.audit:
      return guard('audit.read', <AuditScreen />);
    case paths.config:
      return guard('config.manage', <ConfigScreen />);
    default:
      return <p>{es.app.notFound}</p>;
  }
}

function Forbidden() {
  return <ErrorText>{es.errors.forbidden}</ErrorText>;
}

export function Shell({
  me,
  currentPath,
  onLogout,
  children,
}: {
  me: Me;
  currentPath: string;
  onLogout: () => Promise<void>;
  children: ReactNode;
}) {
  const items = visibleNav(me);
  return (
    <div className="shell">
      <a className="skip-link" href="#main" onClick={skipToMain}>
        {es.app.skipToContent}
      </a>
      <header className="sidebar">
        <p className="brand">
          {es.app.name} <span className="muted">{es.app.subtitle}</span>
        </p>
        <nav aria-label={es.nav.label}>
          <ul className="nav">
            {items.map((item) => (
              <li key={item.key}>
                <a
                  className="nav__link"
                  href={href(item.path)}
                  aria-current={currentPath === item.path ? 'page' : undefined}
                >
                  {item.label}
                </a>
              </li>
            ))}
          </ul>
        </nav>
        <div className="account">
          <p className="account__email">
            <span className="visually-hidden">{es.nav.signedInAs} </span>
            {me.email}
          </p>
          <button
            type="button"
            className="button button--secondary button--block"
            onClick={() => void onLogout()}
          >
            {es.nav.logout}
          </button>
        </div>
      </header>
      <main id="main" className="content" tabIndex={-1}>
        {children}
      </main>
    </div>
  );
}

// The skip link must not change the hash (the hash is the router).
function skipToMain(event: MouseEvent<HTMLAnchorElement>) {
  event.preventDefault();
  document.getElementById('main')?.focus();
}
