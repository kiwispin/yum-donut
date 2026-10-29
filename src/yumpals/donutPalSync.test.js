import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { SOURCE, TARGET, toCommonJs } from '../../scripts/sync-donut-pal.mjs';
import * as app from './donutPal.js';

const require = createRequire(import.meta.url);

test('the server runs exactly the same Donut pal rules as the app', () => {
    assert.equal(readFileSync(TARGET, 'utf8').replace(/\r\n/gu, '\n'), toCommonJs(readFileSync(SOURCE, 'utf8')),
        'functions/src/yumpals/donutPal.js is out of date: run npm run sync:donut-pal');
    const server = require('../../functions/src/yumpals/donutPal.js');
    assert.deepEqual(Object.keys(server).sort(), Object.keys(app).sort());
});
