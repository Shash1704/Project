import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { renderThemeCss, renderTokensCss } from '../src/css';

const root = (p: string) => fileURLToPath(new URL(`../${p}`, import.meta.url));

writeFileSync(root('tokens.css'), renderTokensCss());
writeFileSync(root('theme.css'), renderThemeCss());
console.log('Wrote tokens.css and theme.css');
