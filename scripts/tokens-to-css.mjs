import { readFileSync, writeFileSync } from 'node:fs';

const tokens = JSON.parse(readFileSync(new URL('../design/frostbox/tokens.json', import.meta.url), 'utf8'));
const ref = (v) => (typeof v === 'string' ? v.replace(/^\{(.+)\}$/, 'var(--$1)') : v);
const themed = [...tokens.color.tokens, ...tokens.shadow.tokens];
const plain = [...tokens.spacing.tokens, ...tokens.radius.tokens, ...tokens.size.tokens];

const vars = (theme) =>
  themed.map((t) => `  --${t.name}: ${ref(typeof t.value === 'object' ? t.value[theme] : t.value)};`).join('\n');

const textStyles = tokens.type.groups.flatMap((g) => g.styles).map((s) =>
  [`.t-${s.name} {`, `  font-size: ${s.fontSize};`, `  line-height: ${s.lineHeight};`, `  font-weight: ${s.fontWeight};`,
    s.letterSpacing ? `  letter-spacing: ${s.letterSpacing};` : null, s.name === 'overline' ? '  text-transform: uppercase;' : null,
    s.name === 'quantity' ? '  font-variant-numeric: tabular-nums;' : null, '}'].filter(Boolean).join('\n'));

const css = `/* Generated from design/frostbox/tokens.json by scripts/tokens-to-css.mjs. Do not edit by hand. */
:root {
  color-scheme: light;
  --font-sans: ${tokens.type.families.sans};
  --font-mono: ${tokens.type.families.mono};
${plain.map((t) => `  --${t.name}: ${t.value};`).join('\n')}
${vars('light')}
}

@media (prefers-color-scheme: dark) {
  :root:not([data-theme='light']) {
    color-scheme: dark;
${vars('dark').replace(/^/gm, '  ')}
  }
}

:root[data-theme='dark'] {
  color-scheme: dark;
${vars('dark')}
}

${textStyles.join('\n\n')}
`;
writeFileSync(new URL('../src/app/tokens.css', import.meta.url), css);
console.log(`wrote ${themed.length + plain.length} tokens`);
