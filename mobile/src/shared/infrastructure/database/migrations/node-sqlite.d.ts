// Minimal ambient types for the Node built-in `node:sqlite`, used ONLY by
// Node/Jest migration tests (no runtime dependency is added to the app). The
// React Native tsconfig does not ship Node's type definitions, so this declares
// just the tiny surface those tests touch. Kept in its own ambient .d.ts (no
// imports) so it is a module declaration, not an augmentation.
declare module 'node:sqlite' {
  interface Statement {
    get(): unknown;
    all(): unknown[];
    run(...params: unknown[]): unknown;
  }
  export class DatabaseSync {
    constructor(path: string);
    exec(sql: string): void;
    prepare(sql: string): Statement;
    close(): void;
  }
}
