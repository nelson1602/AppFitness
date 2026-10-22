/* global jest */
// Reanimated 4 runs on the native react-native-worklets runtime, which Jest does
// not have. Use both libraries' own mocks (ADR-P035 motion; Reanimated and
// Worklets testing guides).
jest.mock('react-native-worklets', () => require('react-native-worklets/src/mock'));
jest.mock('react-native-reanimated', () => require('react-native-reanimated/mock'));
