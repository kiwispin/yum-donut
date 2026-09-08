import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
test('outside polish preserves handheld markup and original device stylesheet exactly', () => {
 const path = 'src/yumpals/YumPalsHandheldDemo.jsx';
 const before = execFileSync('git',['show',`1649d82:${path}`],{encoding:'utf8'});
 const after = readFileSync(path,'utf8');
 const device = source => source.slice(source.indexOf('<div className="paid-demo-device-wrap">'),source.indexOf('{notice &&'));
 // Icon callback changed for the separately approved input fix; markup stays identical.
 assert.equal(device(after).replaceAll('onSelect={chooseIcon}', 'onSelect={setSelectedIcon}'),device(before));
 assert.equal(readFileSync('src/yumpals/paidCareDemo.css','utf8'),execFileSync('git',['show','1649d82:src/yumpals/paidCareDemo.css'],{encoding:'utf8'}));
});
test('saved surround polish leaves device markup and all pre-render behaviour unchanged', () => {
 const path='src/yumpals/YumPalsSavedHandheld.jsx';
 const before=execFileSync('git',['show',`821d951:${path}`],{encoding:'utf8'});
 const after=readFileSync(path,'utf8');
 const device=s=>s.slice(s.indexOf('<div className="paid-demo-device"'),s.indexOf('<p className="saved-help'));
 assert.equal(device(after),device(before));
 assert.equal(after.slice(0,after.indexOf('return <section className="paid-demo-shell')),before.slice(0,before.indexOf('return <section className="paid-demo-shell')));
 assert.equal(readFileSync('src/yumpals/savedHandheld.css','utf8'),execFileSync('git',['show','821d951:src/yumpals/savedHandheld.css'],{encoding:'utf8'}));
});
