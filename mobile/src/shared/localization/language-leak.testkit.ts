import { en } from './resources/en';
import { es } from './resources/es';

type Language = 'en' | 'es';

/** The rendered tree as RNTL exposes it (`screen.root`). */
interface RenderedNode {
  props: Record<string, unknown>;
  children: readonly (RenderedNode | string)[];
}

/**
 * The other language's copy that can never be correct in this language: values
 * that differ from every value of this catalogue, at least 4 characters long and
 * without placeholders (an interpolated string never matches exactly).
 */
function leakSet(language: Language): Set<string> {
  const own = new Set<string>(Object.values(language === 'en' ? en : es));
  const other: string[] = Object.values(language === 'en' ? es : en);
  return new Set(
    other.filter((value) => value.length >= 4 && !value.includes('{') && !own.has(value)),
  );
}

/** Every string a person can see or hear: text children and accessibility labels. */
function renderedStrings(node: RenderedNode): string[] {
  const found: string[] = [];
  const visit = (current: RenderedNode | string) => {
    if (typeof current === 'string') {
      found.push(current.trim());
      return;
    }
    const label: unknown = current.props?.accessibilityLabel;
    if (typeof label === 'string') found.push(label.trim());
    for (const child of current.children) visit(child);
  };
  visit(node);
  return found.filter((value) => value.length > 0);
}

/**
 * v8.1 guard (owner report: Spanish strings on English screens and the other
 * way round): the strings in this rendered tree that belong only to the other
 * language. Use it on every tab and main screen, in both languages.
 */
export function otherLanguageStrings(root: RenderedNode | null, language: Language): string[] {
  if (root === null) return ['<nothing rendered>'];
  const leaks = leakSet(language);
  return [...new Set(renderedStrings(root).filter((value) => leaks.has(value)))];
}
