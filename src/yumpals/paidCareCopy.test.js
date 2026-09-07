import assert from 'node:assert/strict';
import { test } from 'node:test';
import { beginPaidCare, careEffectText, createPaidCareDemo, getActionBenefit, getCareValidation } from './paidCareDemo.js';

const fresh = () => createPaidCareDemo(new Date('2026-09-07T00:00:00Z'));

test('every unnecessary care choice explains the actual need and spends nothing', () => {
    const state = fresh();
    const contexts = { meal: /full.*meal/u, snack: /full.*snack/u, game: /happy.*game/u, pat: /happy.*pat/u, clean: /clean.*clean-up/u, medicine: /healthy.*medicine/u, reminder: /settled.*reminder/u };
    for (const [action, context] of Object.entries(contexts)) {
        const result = beginPaidCare(state, action, `copy-${action}`);
        assert.equal(result.code, 'NOOP_FULL');
        assert.match(result.message, context);
        assert.match(result.message, /No donuts spent\./u);
        assert.doesNotMatch(result.message, /meter|flag|noop|delivered|budget/iu);
        assert.equal(result.state, state);
    }
    assert.equal(getCareValidation(state, 'meal').message, 'I’m full! No meal needed. No donuts spent.');
});

test('cost warnings give exact funds and remaining care spending without blocking cheaper care', () => {
    const original = fresh();
    const state = { ...original, pet: { ...original.pet, needs: { ...original.pet.needs, hunger: 0 } } };
    const limited = { ...state, dailySpend: { [state.dateKey]: 24 } };
    assert.equal(getCareValidation(limited, 'meal').message, 'You have 1 donut left to spend on care today. This costs 2. No donuts spent.');
    assert.equal(getCareValidation(limited, 'snack').code, 'OK');
    assert.equal(getCareValidation({ ...state, balance: 0 }, 'meal').message, 'This costs 2 pretend donuts. You have 0. No donuts spent.');
    const bedtime = beginPaidCare(original, 'bedtime', 'lights');
    assert.equal(getCareValidation(bedtime.state, 'bedtime').message, 'Bedtime lights are already set. No donuts spent.');
});

test('confirmation effects describe food rather than increasing hunger and respect partial hearts', () => {
    const original = fresh();
    const state = { ...original, pet: { ...original.pet, needs: { hunger: 3, happiness: 2, cleanliness: 2, health: 2 }, attention: true } };
    const expected = { meal: '+1 Food heart', snack: '+1 Food heart', game: '+2 Happy hearts', pat: '+1 Happy heart', clean: '+2 Clean hearts', medicine: '+2 Health hearts', reminder: 'A gentle reminder to settle down', bedtime: 'Lights out at night; on at 7 am' };
    for (const [action, text] of Object.entries(expected)) assert.equal(careEffectText(getActionBenefit(state, action)), text);
});
