declare const __dirname: string;
declare function require(id: 'node:fs'): {
  readFileSync(file: string, encoding: 'utf8'): string;
  readdirSync(path: string): string[];
};

const fs = require('node:fs');

describe('RevenueCat production boundary', () => {
  const featureRoot = `${__dirname}/..`;
  const production = fs
    .readdirSync(`${featureRoot}/infrastructure`)
    .filter((name) => name.endsWith('.ts') && !name.endsWith('.spec.ts'))
    .map((name) => fs.readFileSync(`${featureRoot}/infrastructure/${name}`, 'utf8'))
    .join('\n');

  it('never creates an anonymous user or sends personal/product-domain attributes', () => {
    expect(production).not.toMatch(/\.logOut\s*\(/);
    expect(production).not.toMatch(
      /\.(?:setEmail|setPhoneNumber|setDisplayName|setAttributes)\s*\(/,
    );
    expect(production).not.toMatch(
      /(?:health|wellness|nutrition|workout|progress)(?:Data|Attribute)/i,
    );
  });

  it('keeps the native SDK import lazy at runtime', () => {
    const adapter = fs.readFileSync(
      `${featureRoot}/infrastructure/revenuecat-purchases.adapter.ts`,
      'utf8',
    );
    expect(adapter).toContain("import('react-native-purchases')");
    expect(adapter).not.toMatch(/^import\s+[^t].*from ['"]react-native-purchases['"]/m);
  });
});
