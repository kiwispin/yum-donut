// Generates the server's copy of the Donut pal rules from the app's copy, so both
// run exactly the same rules. Usage: npm run sync:donut-pal
// src/yumpals/donutPalSync.test.js fails if the server copy is out of date.
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

export const SOURCE = fileURLToPath(new URL('../src/yumpals/donutPal.js', import.meta.url));
export const TARGET = fileURLToPath(new URL('../functions/src/yumpals/donutPal.js', import.meta.url));

// ES module → CommonJS: drop `export`, then list every export at the end.
export function toCommonJs(source) {
    const names = [...source.matchAll(/^export (?:const|function) (\w+)/gmu)].map(match => match[1]);
    if (/^\s*(?:import|export) /mu.test(source.replace(/^export (?:const|function) /gmu, ''))) throw new Error('Unsupported module syntax');
    const body = source.replace(/\r\n/gu, '\n').replace(/^export (const|function) /gmu, '$1 ');
    return `// GENERATED from src/yumpals/donutPal.js by \`npm run sync:donut-pal\`. Do not edit.\n${body}\nmodule.exports = { ${names.join(', ')} };\n`;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
    writeFileSync(TARGET, toCommonJs(readFileSync(SOURCE, 'utf8')));
    console.log(`Wrote ${TARGET}`);
}
