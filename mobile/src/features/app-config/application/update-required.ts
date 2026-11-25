import { Platform } from 'react-native';

import { type AppConfig, isUpdateRequired } from '../domain/app-config';
import { readInstalledVersionCode } from '../infrastructure/installed-app';
import { useAppConfigStore } from './app-config.store';

/** Selector: whether this install is below the server's minimum Android build. */
export function selectUpdateRequired(state: { config: AppConfig }): boolean {
  return isUpdateRequired(
    state.config.minAndroidVersionCode,
    Platform.OS,
    // Read only when there is a minimum: iOS, Web and no-minimum never touch it.
    state.config.minAndroidVersionCode === null ? null : readInstalledVersionCode(),
  );
}

/**
 * True while the installed Android build is below the server's minimum
 * (ADR-P049 amendment 1). Fails open: no config or an unreadable installed
 * version means false.
 */
export function useUpdateRequired(): boolean {
  return useAppConfigStore(selectUpdateRequired);
}
