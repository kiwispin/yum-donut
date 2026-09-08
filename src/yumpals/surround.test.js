import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
test('outside polish preserves handheld markup and original device stylesheet exactly', () => {
 const path = 'src/yumpals/YumPalsHandheldDemo.jsx';
 const before = execFileSync('git',['show',`1649d82:${path}`],{encoding:'utf8'});
 const after = readFileSync(path,'utf8');
 const device = source => source.slice(source.indexOf('<div className="paid-demo-device-wrap">'),source.indexOf('{notice &&'));
 assert.equal(device(after),device(before));
 assert.equal(readFileSync('src/yumpals/paidCareDemo.css','utf8'),execFileSync('git',['show','1649d82:src/yumpals/paidCareDemo.css'],{encoding:'utf8'}));
});
