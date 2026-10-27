/* global jest */
// Reanimated 4 runs on the native react-native-worklets runtime, which Jest does
// not have. Use both libraries' own mocks (ADR-P035 motion; Reanimated and
// Worklets testing guides).
jest.mock('react-native-worklets', () => require('react-native-worklets/src/mock'));
jest.mock('react-native-reanimated', () => require('react-native-reanimated/mock'));

// ADR-P043: the native date picker has no JS implementation under Jest. The
// Android dialog is imperative (`DateTimePickerAndroid.open`), so specs drive
// it through the captured options; the iOS inline picker renders a stub.
jest.mock('@react-native-community/datetimepicker', () => {
  const { View } = require('react-native');
  const DateTimePicker = (props) =>
    require('react').createElement(View, { testID: 'native-date-picker', ...props });
  return {
    __esModule: true,
    default: DateTimePicker,
    DateTimePickerAndroid: { open: jest.fn(), dismiss: jest.fn() },
  };
});
