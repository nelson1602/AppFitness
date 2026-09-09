import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { StyleSheet, type StyleProp, type TextStyle, type ViewStyle } from 'react-native';

import { queryAll, queryFirst, run } from '@/shared/infrastructure/database';
import { lightTheme } from '@/shared/theme';

import type { WellnessSafetyProfile } from '../domain/wellness-safety-profile';
import type { WellnessSafetyProfileState } from '../application/wellness-safety-profile.store';
import { WellnessSafetyProfileScreen } from './WellnessSafetyProfileScreen';

/**
 * ADR-P017 **W-3** capture surface.
 *
 * Covers each canonical state this screen can enter, the conditional date, the
 * token multi-selects, editing, confirmed removal, and the two properties that
 * matter most for a safety surface: **nothing clinical can be typed**, and the
 * selected state is never conveyed by colour alone.
 */

const load = jest.fn();
const save = jest.fn();
const remove = jest.fn();

let mockState: WellnessSafetyProfileState;
let mockLanguage: 'en' | 'es' = 'en';

jest.mock('../application/wellness-safety-profile.store', () => ({
  useWellnessSafetyProfileStore: (selector?: (s: WellnessSafetyProfileState) => unknown) =>
    selector ? selector(mockState) : mockState,
}));
jest.mock('@/shared/localization', () => {
  const { en } = jest.requireActual('@/shared/localization/resources/en') as {
    en: Record<string, string>;
  };
  const { es } = jest.requireActual('@/shared/localization/resources/es') as {
    es: Record<string, string>;
  };
  return {
    useLocalization: () => ({
      language: mockLanguage,
      t: (key: string) => (mockLanguage === 'es' ? es[key] : en[key]) ?? key,
    }),
  };
});
// Direct SQLite access from the UI is forbidden (.ai/06_MOBILE.md): persistence
// must route through the store → service → repository. Spy on the database
// module to prove this screen never calls it.
jest.mock('@/shared/infrastructure/database', () => ({
  inTransaction: jest.fn(),
  queryAll: jest.fn(),
  queryFirst: jest.fn(),
  run: jest.fn(),
}));

const profile = (overrides: Partial<WellnessSafetyProfile> = {}): WellnessSafetyProfile => ({
  id: 'user-1',
  userId: 'user-1',
  evaluationCompleted: true,
  evaluationDate: '2026-01-02',
  affectedAreas: ['knee', 'lower_back'],
  movementsToAvoid: ['jumping'],
  createdAt: '2026-01-02T10:00:00.000Z',
  updatedAt: '2026-01-02T10:00:00.000Z',
  version: 2,
  deletedAt: null,
  deletedBy: null,
  ...overrides,
});

function setStore(partial: Partial<WellnessSafetyProfileState>) {
  mockState = {
    status: 'ready',
    profile: null,
    sync: 'synced',
    error: null,
    outcome: null,
    load,
    save,
    remove,
    ...partial,
  };
}

/** Resolved text colour, so tone is asserted as rendered behaviour. */
function colorOf(node: { props: { style?: StyleProp<TextStyle> } }): TextStyle['color'] {
  return StyleSheet.flatten(node.props.style)?.color;
}

function viewStyle(node: { props: { style?: StyleProp<ViewStyle> } }): ViewStyle {
  return StyleSheet.flatten(node.props.style) ?? {};
}

/**
 * Every rendered text input, however it was produced — the shared `FormField`,
 * a raw `TextInput`, or anything added later. Counting the host nodes is what
 * makes "there is nowhere to type a clinical note" a structural assertion
 * rather than a statement about the fields this spec happens to know about.
 */
function textInputs() {
  return screen.container.queryAll((node) => node.type === 'TextInput');
}

/** A date that is certainly in the future on any device running this suite. */
function tomorrow(): string {
  const date = new Date();
  date.setDate(date.getDate() + 1);
  return date.toISOString().slice(0, 10);
}

beforeEach(() => {
  jest.clearAllMocks();
  mockLanguage = 'en';
  save.mockResolvedValue(true);
  remove.mockResolvedValue(true);
  setStore({});
});

describe('canonical states', () => {
  it('loads on mount and shows Loading with no form', async () => {
    setStore({ status: 'loading' });

    await render(<WellnessSafetyProfileScreen />);

    await waitFor(() => expect(load).toHaveBeenCalledTimes(1));
    expect(screen.getByTestId('wellness-loading')).toBeOnTheScreen();
    expect(screen.getByLabelText('Loading your evaluation and limitations')).toBeOnTheScreen();
    // A blank form during a read would look like "nothing declared".
    expect(screen.queryByTestId('wellness-save')).toBeNull();
  });

  it('shows Empty as a successful read with the blank form ready to fill', async () => {
    setStore({ status: 'ready', profile: null });

    await render(<WellnessSafetyProfileScreen />);

    expect(screen.getByTestId('wellness-empty')).toHaveTextContent(
      'You have not declared anything yet.',
    );
    expect(screen.getByTestId('wellness-save')).toBeOnTheScreen();
    // Nothing to remove yet.
    expect(screen.queryByTestId('wellness-remove')).toBeNull();
  });

  it('renders Error with a retry, and hides the form while the read is unknown', async () => {
    setStore({ status: 'error', error: 'load' });

    await render(<WellnessSafetyProfileScreen />);
    expect(screen.getByText('Something went wrong')).toBeOnTheScreen();
    expect(
      screen.getByText('Your evaluation and limitations could not be loaded right now.'),
    ).toBeOnTheScreen();
    expect(screen.queryByTestId('wellness-save')).toBeNull();

    await fireEvent.press(
      screen.getByRole('button', { name: 'Try loading your evaluation and limitations again' }),
    );
    expect(load).toHaveBeenCalledTimes(2);
  });

  it('renders a refused stored row as safe copy, exposing no reason or value', async () => {
    setStore({ status: 'error', error: 'invalid' });

    await render(<WellnessSafetyProfileScreen />);

    expect(screen.getByText('These details cannot be shown')).toBeOnTheScreen();
    expect(
      screen.getByText(
        'The copy saved on this device cannot be read safely, so we left it exactly as it is. Fill in the form and save to replace it.',
      ),
    ).toBeOnTheScreen();
    // No decoder detail reaches the screen.
    expect(screen.queryByText(/unknown-token/)).toBeNull();
    expect(screen.queryByText(/affected_areas/)).toBeNull();
    expect(screen.queryByText(/invalid/i)).toBeNull();
    // Re-entry is the offered recovery, so the form stays available…
    expect(screen.getByTestId('wellness-save')).toBeOnTheScreen();
    // …and nothing is removed on the user's behalf.
    expect(remove).not.toHaveBeenCalled();
  });

  it('renders the Web-unavailable state with no form and no retry (ADR-P019)', async () => {
    setStore({ status: 'web-unavailable' });

    await render(<WellnessSafetyProfileScreen />);

    expect(
      screen.getByText("Evaluation and limitations aren't available on the web"),
    ).toBeOnTheScreen();
    expect(
      screen.getByText('Use the AppFitnessRD mobile app to add or change these details.'),
    ).toBeOnTheScreen();
    // No unsaveable form, no retry, no fabricated answers.
    expect(screen.queryByTestId('wellness-save')).toBeNull();
    expect(screen.queryByTestId('wellness-retry')).toBeNull();
    expect(screen.queryByTestId('wellness-empty')).toBeNull();
    expect(screen.queryByText('Something went wrong')).toBeNull();
  });

  it('renders the Web-unavailable state in Spanish', async () => {
    mockLanguage = 'es';
    setStore({ status: 'web-unavailable' });

    await render(<WellnessSafetyProfileScreen />);

    expect(
      screen.getByText('La evaluación y las limitaciones no están disponibles en la web'),
    ).toBeOnTheScreen();
    expect(screen.queryByTestId('wellness-save')).toBeNull();
  });

  it('reassures that a queued write is safely stored on the device', async () => {
    setStore({ status: 'ready', profile: profile(), sync: 'pending' });

    await render(<WellnessSafetyProfileScreen />);

    const hint = screen.getByTestId('wellness-sync-pending');
    expect(hint).toHaveTextContent('Saved on this device');
    expect(hint.props.accessibilityLabel).toBe('Saved on this device; sync pending');
    // Pending is not a failure.
    expect(colorOf(hint)).toBe(lightTheme.colors.onSurfaceVariant);
  });

  it('reports a divergence as warning, never error, and offers no resolution', async () => {
    setStore({ status: 'ready', profile: profile(), sync: 'conflict' });

    await render(<WellnessSafetyProfileScreen />);

    expect(screen.getByTestId('wellness-conflict')).toBeOnTheScreen();
    const title = screen.getByText('These details need review');
    expect(colorOf(title)).toBe(lightTheme.colors.warning);
    expect(colorOf(title)).not.toBe(lightTheme.colors.error);
    // Report-only (BUG-012): no chooser, no "resolve", no review destination.
    expect(screen.queryByText(/resolve/i)).toBeNull();
    expect(screen.queryByText(/keep mine|keep the server/i)).toBeNull();
    // It also must not claim both versions are preserved (BUG-014).
    expect(screen.queryByText(/both versions/i)).toBeNull();
  });
});

describe('write confirmations', () => {
  // Every outcome × sync-state pair, because "not pending" is not the same
  // as "synchronized": treating it that way let a parked conflict render
  // "up to date" beside the conflict warning.
  const OUTCOMES: [
    outcome: 'saved' | 'removed',
    sync: 'synced' | 'pending' | 'conflict',
    title: string,
    body: string,
    tone: keyof typeof lightTheme.colors,
  ][] = [
    ['saved', 'synced', 'Saved', 'Your evaluation and limitations are up to date.', 'success'],
    [
      'saved',
      'pending',
      'Saved on this device',
      'Your answers are stored on this device and are waiting to synchronize.',
      'info',
    ],
    [
      'saved',
      'conflict',
      'Saved here; a synchronization difference remains',
      'Your change is stored on this device. This record still differs from the synchronized copy, and saving does not change that difference.',
      'warning',
    ],
    [
      'removed',
      'synced',
      'Removed from your profile',
      'Nothing is declared in your profile now. You can add these details again whenever you want.',
      'success',
    ],
    [
      'removed',
      'pending',
      'Removed on this device',
      'These details are no longer part of your active profile here. The removal is stored on this device and is waiting to synchronize.',
      'info',
    ],
    [
      'removed',
      'conflict',
      'Removed here; a synchronization difference remains',
      'These details are no longer part of your active profile on this device. This record still differs from the synchronized copy, and removing does not change that difference.',
      'warning',
    ],
  ];

  it.each(OUTCOMES)(
    'confirms a %s write under %s with the matching wording and tone',
    async (outcome, sync, title, body, tone) => {
      setStore({
        status: 'ready',
        profile: outcome === 'removed' ? null : profile(),
        sync,
        outcome,
      });

      await render(<WellnessSafetyProfileScreen />);

      expect(screen.getByTestId(`wellness-${outcome}`)).toBeOnTheScreen();
      expect(screen.getByText(title)).toBeOnTheScreen();
      expect(screen.getByText(body)).toBeOnTheScreen();
      // Tone is asserted as the rendered colour, so a rename cannot silently
      // turn a warning into a success.
      expect(colorOf(screen.getByText(title))).toBe(
        tone === 'info' ? lightTheme.colors.primary : lightTheme.colors[tone],
      );
    },
  );

  it.each(['saved', 'removed'] as const)(
    'never claims a %s write is complete or up to date while a conflict is parked',
    async (outcome) => {
      setStore({
        status: 'ready',
        profile: outcome === 'removed' ? null : profile(),
        sync: 'conflict',
        outcome,
      });

      await render(<WellnessSafetyProfileScreen />);

      // The synced wording — the only wording that claims completion — must
      // not appear at all.
      expect(screen.queryByText('Saved')).toBeNull();
      expect(screen.queryByText('Your evaluation and limitations are up to date.')).toBeNull();
      expect(screen.queryByText('Removed from your profile')).toBeNull();
      expect(
        screen.queryByText(
          'Nothing is declared in your profile now. You can add these details again whenever you want.',
        ),
      ).toBeNull();

      // Scoped to the confirmation itself: the screen legitimately asks
      // "Have you completed a professional physical evaluation?", so a
      // whole-screen word search would match the question, not a claim.
      const confirmation = screen.getByTestId(`wellness-${outcome}`);
      expect(confirmation).not.toHaveTextContent(/up to date|complete|resolved|everywhere/i);
      // It acknowledges the local action and names the remaining difference…
      expect(confirmation).toHaveTextContent(/difference remains/);
      // …and the report-only conflict banner still renders beneath it.
      expect(screen.getByTestId('wellness-conflict')).toBeOnTheScreen();
      expect(screen.getByText('These details need review')).toBeOnTheScreen();
    },
  );

  it('does not repeat the pending caption when a confirmation is showing', async () => {
    setStore({ status: 'ready', profile: profile(), sync: 'pending', outcome: 'saved' });

    await render(<WellnessSafetyProfileScreen />);

    expect(screen.queryByTestId('wellness-sync-pending')).toBeNull();
  });

  it('surfaces a save failure without wiping what was entered', async () => {
    setStore({ status: 'ready', profile: null, error: 'save' });

    await render(<WellnessSafetyProfileScreen />);
    await fireEvent.press(screen.getByTestId('wellness-area-knee'));

    expect(screen.getByText('Not saved')).toBeOnTheScreen();
    await waitFor(() =>
      expect(screen.getByTestId('wellness-area-knee').props.accessibilityState.checked).toBe(true),
    );
  });

  it('asks the user to check their answers when the domain refuses them', async () => {
    setStore({ status: 'ready', profile: null, error: 'invalidInput' });

    await render(<WellnessSafetyProfileScreen />);

    expect(screen.getByText('Check your answers')).toBeOnTheScreen();
    expect(
      screen.getByText(
        'Some of what you entered could not be accepted. Review the date and your selections, then save again.',
      ),
    ).toBeOnTheScreen();
    // A rejected value, field or reason is never echoed.
    expect(screen.queryByText(/date-in-the-future|evaluation_date/)).toBeNull();
    // The form stays, so the answer can be corrected in place.
    expect(screen.getByTestId('wellness-save')).toBeOnTheScreen();
  });

  it('surfaces a removal failure', async () => {
    setStore({ status: 'ready', profile: profile(), error: 'remove' });

    await render(<WellnessSafetyProfileScreen />);

    expect(screen.getByText('Not removed')).toBeOnTheScreen();
    expect(
      screen.getByText('Your evaluation and limitations could not be removed. Please try again.'),
    ).toBeOnTheScreen();
  });
});

describe('the evaluation question and its conditional date', () => {
  it('asks only whether an evaluation was completed, with no date until it was', async () => {
    setStore({ status: 'ready', profile: null });

    await render(<WellnessSafetyProfileScreen />);

    // The shared `FormSelect` appends a required marker, so the legend is
    // matched by pattern rather than by exact equality.
    expect(
      screen.getByText(/Have you completed a professional physical evaluation\?/),
    ).toBeOnTheScreen();
    expect(screen.queryByTestId('wellness-date-section')).toBeNull();
    expect(screen.queryByTestId('field-evaluationDate')).toBeNull();
  });

  it('reveals the date field, visible and keyboard reachable, once answered yes', async () => {
    setStore({ status: 'ready', profile: null });

    await render(<WellnessSafetyProfileScreen />);
    await fireEvent.press(screen.getByTestId('option-evaluationCompleted-yes'));

    const section = await screen.findByTestId('wellness-date-section');
    expect(section).toBeOnTheScreen();
    // ADR-P024 Decision 3 authorizes `aria-live` on exactly one node — the
    // localized validation-error message `FormField` already renders — so this
    // slice attaches NO announcement mechanism to the newly inserted content,
    // and claims none. The field is simply visible and reachable.
    expect(section.props['aria-live']).toBeUndefined();
    expect(section.props.accessibilityLiveRegion).toBeUndefined();
    const input = screen.getByTestId('field-evaluationDate');
    expect(input).toBeOnTheScreen();
    // A real text field, so it is reachable and editable from a keyboard.
    expect(input.props.editable).not.toBe(false);
    expect(
      screen.getByText('Just the date. We do not ask who performed it or what it found.'),
    ).toBeOnTheScreen();
  });

  it('hides the date again when the answer goes back to "not yet"', async () => {
    setStore({ status: 'ready', profile: profile() });

    await render(<WellnessSafetyProfileScreen />);
    expect(screen.getByTestId('field-evaluationDate')).toBeOnTheScreen();

    await fireEvent.press(screen.getByTestId('option-evaluationCompleted-no'));

    await waitFor(() => expect(screen.queryByTestId('wellness-date-section')).toBeNull());
  });

  it('requires the date for a completed evaluation', async () => {
    setStore({ status: 'ready', profile: null });

    await render(<WellnessSafetyProfileScreen />);
    await fireEvent.press(screen.getByTestId('option-evaluationCompleted-yes'));
    await fireEvent.press(screen.getByTestId('wellness-save'));

    expect(await screen.findByText('Add the date of the evaluation')).toBeOnTheScreen();
    expect(save).not.toHaveBeenCalled();
  });

  it('rejects a date that is not a real calendar date', async () => {
    setStore({ status: 'ready', profile: null });

    await render(<WellnessSafetyProfileScreen />);
    await fireEvent.press(screen.getByTestId('option-evaluationCompleted-yes'));
    await fireEvent.changeText(screen.getByTestId('field-evaluationDate'), '2026-02-31');
    await fireEvent.press(screen.getByTestId('wellness-save'));

    expect(await screen.findByText('Enter a real calendar date')).toBeOnTheScreen();
    expect(save).not.toHaveBeenCalled();
  });

  it('rejects a device-local future date', async () => {
    setStore({ status: 'ready', profile: null });

    await render(<WellnessSafetyProfileScreen />);
    await fireEvent.press(screen.getByTestId('option-evaluationCompleted-yes'));
    await fireEvent.changeText(screen.getByTestId('field-evaluationDate'), tomorrow());
    await fireEvent.press(screen.getByTestId('wellness-save'));

    expect(await screen.findByText('The date cannot be in the future')).toBeOnTheScreen();
    expect(save).not.toHaveBeenCalled();
  });

  it('saves a past date with the device-local today it was validated against', async () => {
    setStore({ status: 'ready', profile: null });

    await render(<WellnessSafetyProfileScreen />);
    await fireEvent.press(screen.getByTestId('option-evaluationCompleted-yes'));
    await fireEvent.changeText(screen.getByTestId('field-evaluationDate'), '2020-05-06');
    await fireEvent.press(screen.getByTestId('wellness-save'));

    await waitFor(() => expect(save).toHaveBeenCalledTimes(1));
    const [input, today] = save.mock.calls[0];
    expect(input).toEqual({
      evaluationCompleted: true,
      evaluationDate: '2020-05-06',
      affectedAreas: [],
      movementsToAvoid: [],
    });
    // The same calendar date the form validated against reaches the service.
    expect(today).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});

describe('token selection', () => {
  it('offers every affected area and movement from the closed vocabularies', async () => {
    setStore({ status: 'ready', profile: null });

    await render(<WellnessSafetyProfileScreen />);

    expect(screen.getAllByTestId(/^wellness-area-[a-z_]+$/)).toHaveLength(18);
    expect(screen.getAllByTestId(/^wellness-movement-[a-z_]+$/)).toHaveLength(18);
    // `head` is deliberately absent from the vocabulary (W-1).
    expect(screen.queryByTestId('wellness-area-head')).toBeNull();
  });

  it('persists language-neutral tokens, never the labels the user read', async () => {
    setStore({ status: 'ready', profile: null });

    await render(<WellnessSafetyProfileScreen />);
    await fireEvent.press(screen.getByTestId('wellness-area-lower_back'));
    await fireEvent.press(screen.getByTestId('wellness-movement-running'));
    await fireEvent.press(screen.getByTestId('wellness-save'));

    await waitFor(() => expect(save).toHaveBeenCalledTimes(1));
    expect(save.mock.calls[0][0]).toEqual({
      evaluationCompleted: false,
      evaluationDate: null,
      affectedAreas: ['lower_back'],
      movementsToAvoid: ['running'],
    });
  });

  it('persists the same tokens when the labels are Spanish', async () => {
    mockLanguage = 'es';
    setStore({ status: 'ready', profile: null });

    await render(<WellnessSafetyProfileScreen />);
    expect(screen.getByTestId('wellness-area-lower_back')).toHaveTextContent('Espalda baja');
    await fireEvent.press(screen.getByTestId('wellness-area-lower_back'));
    await fireEvent.press(screen.getByTestId('wellness-save'));

    await waitFor(() => expect(save).toHaveBeenCalledTimes(1));
    expect(save.mock.calls[0][0].affectedAreas).toEqual(['lower_back']);
  });

  it('toggles a token off again', async () => {
    setStore({ status: 'ready', profile: null });

    await render(<WellnessSafetyProfileScreen />);
    await fireEvent.press(screen.getByTestId('wellness-area-knee'));
    await fireEvent.press(screen.getByTestId('wellness-area-knee'));
    await fireEvent.press(screen.getByTestId('wellness-save'));

    await waitFor(() => expect(save).toHaveBeenCalledTimes(1));
    expect(save.mock.calls[0][0].affectedAreas).toEqual([]);
  });

  it('allows limitations with no evaluation at all (W-1 invariant 4)', async () => {
    setStore({ status: 'ready', profile: null });

    await render(<WellnessSafetyProfileScreen />);
    // The answer stays "not yet"; the groups are still selectable.
    await fireEvent.press(screen.getByTestId('wellness-movement-jumping'));
    await fireEvent.press(screen.getByTestId('wellness-save'));

    await waitFor(() => expect(save).toHaveBeenCalledTimes(1));
    expect(save.mock.calls[0][0]).toMatchObject({
      evaluationCompleted: false,
      evaluationDate: null,
      movementsToAvoid: ['jumping'],
    });
  });

  it('explains that an empty selection is no declaration, not a clearance', async () => {
    setStore({ status: 'ready', profile: null });

    await render(<WellnessSafetyProfileScreen />);

    expect(screen.getByTestId('wellness-nothing-declared')).toHaveTextContent(
      'Selecting nothing records that you declared no limitations. It does not mean you are cleared or medically fit to train.',
    );

    await fireEvent.press(screen.getByTestId('wellness-area-knee'));
    await waitFor(() => expect(screen.queryByTestId('wellness-nothing-declared')).toBeNull());
  });
});

describe('editing what is stored', () => {
  it('prefills the stored answers, tokens included', async () => {
    setStore({ status: 'ready', profile: profile() });

    await render(<WellnessSafetyProfileScreen />);

    expect(
      screen.getByTestId('option-evaluationCompleted-yes').props.accessibilityState.selected,
    ).toBe(true);
    expect(screen.getByTestId('field-evaluationDate').props.value).toBe('2026-01-02');
    expect(screen.getByTestId('wellness-area-knee').props.accessibilityState.checked).toBe(true);
    expect(screen.getByTestId('wellness-area-lower_back').props.accessibilityState.checked).toBe(
      true,
    );
    expect(screen.getByTestId('wellness-movement-jumping').props.accessibilityState.checked).toBe(
      true,
    );
    expect(screen.getByTestId('wellness-area-ankle').props.accessibilityState.checked).toBe(false);
    expect(screen.queryByTestId('wellness-empty')).toBeNull();
  });

  it('saves an edit that adds one area and drops another', async () => {
    setStore({ status: 'ready', profile: profile() });

    await render(<WellnessSafetyProfileScreen />);
    await fireEvent.press(screen.getByTestId('wellness-area-knee'));
    await fireEvent.press(screen.getByTestId('wellness-area-shoulder'));
    await fireEvent.press(screen.getByTestId('wellness-save'));

    await waitFor(() => expect(save).toHaveBeenCalledTimes(1));
    expect(save.mock.calls[0][0].affectedAreas).toEqual(['lower_back', 'shoulder']);
  });

  it('clears the date when a stored evaluation is changed to "not yet"', async () => {
    setStore({ status: 'ready', profile: profile() });

    await render(<WellnessSafetyProfileScreen />);
    await fireEvent.press(screen.getByTestId('option-evaluationCompleted-no'));
    await fireEvent.press(screen.getByTestId('wellness-save'));

    await waitFor(() => expect(save).toHaveBeenCalledTimes(1));
    expect(save.mock.calls[0][0]).toMatchObject({
      evaluationCompleted: false,
      evaluationDate: null,
    });
  });
});

describe('removal is confirmed, never silent', () => {
  it('asks first, and removes only after the explicit confirmation', async () => {
    setStore({ status: 'ready', profile: profile() });

    await render(<WellnessSafetyProfileScreen />);
    await fireEvent.press(screen.getByTestId('wellness-remove'));

    expect(screen.getByText('Remove these details from your profile?')).toBeOnTheScreen();
    // W-2 soft-deletes and keeps a tombstone, so the confirmation describes
    // removal from the active profile and points at account deletion for
    // erasure — it must not promise that the values stop being kept.
    expect(
      screen.getByText(
        'They stop being part of your active profile and the app no longer shows or uses them. A record of the removal stays on this device and synchronizes to your other devices. Deleting your account permanently removes the account and its data, keeping only an anonymized security audit record.',
      ),
    ).toBeOnTheScreen();
    expect(remove).not.toHaveBeenCalled();

    await fireEvent.press(screen.getByTestId('wellness-remove-confirm'));
    await waitFor(() => expect(remove).toHaveBeenCalledTimes(1));
  });

  it('keeps the confirmation open when the removal does not go through', async () => {
    remove.mockResolvedValue(false);
    setStore({ status: 'ready', profile: profile() });

    await render(<WellnessSafetyProfileScreen />);
    await fireEvent.press(screen.getByTestId('wellness-remove'));
    await fireEvent.press(screen.getByTestId('wellness-remove-confirm'));

    await waitFor(() => expect(remove).toHaveBeenCalledTimes(1));
    // The user is not silently returned to a state that implies success.
    expect(screen.getByTestId('wellness-remove-confirm-section')).toBeOnTheScreen();
  });

  it('cancels without removing anything', async () => {
    setStore({ status: 'ready', profile: profile() });

    await render(<WellnessSafetyProfileScreen />);
    await fireEvent.press(screen.getByTestId('wellness-remove'));
    await fireEvent.press(screen.getByTestId('wellness-remove-cancel'));

    expect(screen.queryByTestId('wellness-remove-confirm-section')).toBeNull();
    expect(screen.getByTestId('wellness-remove')).toBeOnTheScreen();
    expect(remove).not.toHaveBeenCalled();
  });

  it('offers no removal when there is nothing stored', async () => {
    setStore({ status: 'ready', profile: null });

    await render(<WellnessSafetyProfileScreen />);

    expect(screen.queryByTestId('wellness-remove')).toBeNull();
  });
});

describe('what the surface must never collect or claim', () => {
  it('has exactly one text input — the date — and no free-text field', async () => {
    setStore({ status: 'ready', profile: profile() });

    await render(<WellnessSafetyProfileScreen />);

    const inputs = textInputs();
    expect(inputs).toHaveLength(1);
    expect(inputs[0].props.testID).toBe('field-evaluationDate');
  });

  it('has no text input at all when no evaluation is reported', async () => {
    setStore({ status: 'ready', profile: null });

    await render(<WellnessSafetyProfileScreen />);

    expect(textInputs()).toHaveLength(0);
  });

  it('states the non-clinical positioning before asking anything', async () => {
    setStore({ status: 'ready', profile: null });

    await render(<WellnessSafetyProfileScreen />);

    expect(screen.getByText('This is fitness software, not a medical opinion')).toBeOnTheScreen();
    expect(
      screen.getByText(
        'AppFitnessRD is a fitness and general-wellness app. It does not diagnose, treat, or decide whether exercise is safe for you, and it never says that you are cleared or medically fit. Talk to a qualified professional about your health.',
      ),
    ).toBeOnTheScreen();
    expect(screen.getByTestId('wellness-privacy-note')).toHaveTextContent(
      /We never ask who evaluated you or what was found/,
    );
  });

  it('never touches the local database directly', async () => {
    setStore({ status: 'ready', profile: profile() });

    await render(<WellnessSafetyProfileScreen />);
    await fireEvent.press(screen.getByTestId('wellness-area-ankle'));
    await fireEvent.press(screen.getByTestId('wellness-save'));

    await waitFor(() => expect(save).toHaveBeenCalledTimes(1));
    expect(jest.mocked(run)).not.toHaveBeenCalled();
    expect(jest.mocked(queryAll)).not.toHaveBeenCalled();
    expect(jest.mocked(queryFirst)).not.toHaveBeenCalled();
  });
});

describe('accessibility of the token groups', () => {
  it('gives every chip a checkbox role, a state and a group-qualified name', async () => {
    setStore({ status: 'ready', profile: null });

    await render(<WellnessSafetyProfileScreen />);

    const chip = screen.getByTestId('wellness-area-knee');
    expect(chip.props.accessibilityRole).toBe('checkbox');
    expect(chip.props.accessibilityState).toMatchObject({ checked: false, selected: false });
    expect(chip.props.accessibilityLabel).toBe('Body areas to treat carefully: Knee');

    const movement = screen.getByTestId('wellness-movement-jumping');
    expect(movement.props.accessibilityLabel).toBe('Movements you would rather avoid: Jumping');
  });

  it('conveys selection without colour: a marker, a heavier border and the state', async () => {
    setStore({ status: 'ready', profile: null });

    await render(<WellnessSafetyProfileScreen />);

    const before = screen.getByTestId('wellness-area-knee');
    expect(
      screen.queryByTestId('wellness-area-knee-marker', { includeHiddenElements: true }),
    ).toBeNull();
    expect(viewStyle(before).borderWidth).toBe(1);

    await fireEvent.press(before);

    await waitFor(() =>
      expect(screen.getByTestId('wellness-area-knee').props.accessibilityState).toMatchObject({
        checked: true,
        selected: true,
      }),
    );
    // Non-colour signals: a visible marker and a thicker border.
    expect(
      screen.getByTestId('wellness-area-knee-marker', { includeHiddenElements: true }),
    ).toBeOnTheScreen();
    expect(viewStyle(screen.getByTestId('wellness-area-knee')).borderWidth).toBe(2);
  });

  it('keeps the selected marker out of the accessible name', async () => {
    setStore({ status: 'ready', profile: profile() });

    await render(<WellnessSafetyProfileScreen />);

    // Hidden from assistive technology by design: it duplicates the state the
    // chip already exposes, so it is decorative for AT (icon contract).
    const marker = screen.getByTestId('wellness-area-knee-marker', {
      includeHiddenElements: true,
    });
    expect(marker.props.accessibilityElementsHidden).toBe(true);
    expect(marker.props.importantForAccessibility).toBe('no');
    expect(screen.getByTestId('wellness-area-knee').props.accessibilityLabel).toBe(
      'Body areas to treat carefully: Knee',
    );
  });

  it('meets the 44pt minimum touch target on every chip', async () => {
    setStore({ status: 'ready', profile: null });

    await render(<WellnessSafetyProfileScreen />);

    for (const chip of screen.getAllByTestId(/^wellness-(area|movement)-[a-z_]+$/)) {
      expect(viewStyle(chip).minHeight).toBeGreaterThanOrEqual(44);
    }
  });

  it('labels each group and states what it collects', async () => {
    setStore({ status: 'ready', profile: null });

    await render(<WellnessSafetyProfileScreen />);

    expect(screen.getAllByLabelText('Body areas to treat carefully').length).toBeGreaterThan(0);
    expect(
      screen.getByText(
        'Pick from the list. Areas of the body only — never a condition, a cause or how severe it is.',
      ),
    ).toBeOnTheScreen();
    expect(
      screen.getByText('Pick from the list. You can change this whenever you want.'),
    ).toBeOnTheScreen();
  });
});
