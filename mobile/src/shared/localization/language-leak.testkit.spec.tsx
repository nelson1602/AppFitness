import { render, screen } from '@testing-library/react-native';
import { Text, View } from 'react-native';

import { otherLanguageStrings } from './language-leak.testkit';
import { en } from './resources/en';
import { es } from './resources/es';

describe('otherLanguageStrings (v8.1 language guard)', () => {
  it('finds Spanish copy on an English screen, including accessibility labels', async () => {
    await render(
      <View accessibilityLabel={es['profile.tab.settingsTitle']}>
        <Text>{en['tabs.profile']}</Text>
        <Text>{es['tabs.progress']}</Text>
      </View>,
    );

    expect(otherLanguageStrings(screen.root, 'en').sort()).toEqual(
      [es['profile.tab.settingsTitle'], es['tabs.progress']].sort(),
    );
  });

  it('finds English copy on a Spanish screen and ignores words both languages share', async () => {
    await render(
      <View>
        <Text>{en['dashboard.syncNow']}</Text>
        <Text>iCoach</Text>
        <Text>{es['tabs.home']}</Text>
      </View>,
    );

    expect(otherLanguageStrings(screen.root, 'es')).toEqual([en['dashboard.syncNow']]);
  });

  it('passes a screen written entirely in its own language', async () => {
    await render(<Text>{es['workouts.week.done']}</Text>);
    expect(otherLanguageStrings(screen.root, 'es')).toEqual([]);
  });
});
