// The real Donut pal handheld against a stand-in server in the page (same rules,
// replies checked by the real client checks). No account and no network.
// ?nopal=1 adoption · ?fail=1 first read fails · ?slow=ms reply delay · ?paused=1
import React from 'react';
import { createRoot } from 'react-dom/client';
import YumPalsDonutSaved from '../src/yumpals/YumPalsDonutSaved.jsx';
import { validateActReply, validatePocketView } from '../src/yumpals/pocketClient.js';
import { GAME_ROUNDS, act, advance, aucklandParts, createDonutPal, takeEvents } from '../src/yumpals/donutPal.js';
import '../src/index.css';

const params = new URLSearchParams(window.location.search);
const UID = 'student-a';
const server = {
    offset: 0, reads: 0, acts: [], failNext: params.get('fail') === '1', failNextAct: false, wallet: 5, visitDate: '',
    pet: params.get('nopal') === '1' ? null : { name: 'Niblet', species: 'mossbit', casing: 'berry', color: '#d94878', reducedMotion: false },
    pal: null, game: null,
};
const now = () => Date.now() + server.offset;
if (server.pet) server.pal = createDonutPal({ name: server.pet.name, species: server.pet.species, nowMs: now() });
const strip = pal => ({ ...takeEvents(pal).pal });

function view(extra = {}) {
    const ms = now(); const parts = aucklandParts(ms);
    return { schemaVersion: 1, kind: 'pocket', ownerUid: UID, enabled: params.get('paused') !== '1', serverNowMs: ms, aucklandDate: parts.date,
        aucklandHour: parts.hour, aucklandMinute: parts.minute, prices: { snack: 1, adoption: 5 }, wallet: { available: true, balance: server.wallet },
        pal: server.pet ? { ...server.pet, state: strip(server.pal), game: server.game ? { id: server.game.id, results: [...server.game.results] } : null } : null, ...extra };
}
const wait = () => new Promise(resolve => setTimeout(resolve, Number(params.get('slow') || 80)));
const failure = () => Object.assign(new Error('offline'), { details: { reason: 'UNAVAILABLE' } });

const transport = {
    read: async uid => {
        await wait(); server.reads++;
        if (server.failNext) { server.failNext = false; throw failure(); }
        const gifts = {};
        if (server.pet) {
            server.pal = strip(advance(server.pal, now()));
            const date = aucklandParts(now()).date;
            if (server.pal.stage !== 'egg' && server.visitDate !== date) {
                server.visitDate = date;
                const key = server.pal.happy < server.pal.hunger ? 'happy' : 'hunger';
                const gains = { hunger: 0, happy: 0 };
                if (server.pal[key] < 4) { server.pal = { ...server.pal, [key]: server.pal[key] + 1 }; gains[key] = 1; }
                gifts.visit = { date, welcomeBack: false, gains };
            }
        }
        return validatePocketView(view(gifts), uid);
    },
    act: async (uid, request) => {
        await wait(); server.acts.push(request);
        if (server.failNextAct) { server.failNextAct = false; throw failure(); }
        const outcome = { action: request.action, ok: false, reason: null, animation: 'no', amount: 0, walletBefore: null, walletAfter: null };
        const charge = amount => Object.assign(outcome, { amount, walletBefore: server.wallet, walletAfter: server.wallet - amount, category: 'pet_spend' });
        if (request.action === 'adopt') {
            if (server.wallet < 5) outcome.reason = 'donuts';
            else {
                charge(5); server.wallet -= 5;
                server.pet = { name: request.adoption.name, species: request.adoption.species, casing: request.adoption.casing, color: request.adoption.color, reducedMotion: false };
                server.pal = createDonutPal({ name: server.pet.name, species: server.pet.species, nowMs: now() });
                Object.assign(outcome, { ok: true, animation: 'adopted' });
            }
        } else if (request.action === 'guess') {
            if (request.round === 0) server.game = { id: request.gameId, results: [] };
            const target = Math.random() < 0.5 ? 'left' : 'right';
            const results = [...server.game.results, request.choice === target];
            outcome.game = { gameId: request.gameId, round: request.round, choice: request.choice, target, correct: request.choice === target,
                wins: results.filter(Boolean).length, complete: results.length === GAME_ROUNDS };
            if (outcome.game.complete) {
                const result = act(server.pal, 'game', { nowMs: now(), wins: outcome.game.wins });
                server.pal = strip(result.pal); server.game = null;
                Object.assign(outcome, result.ok ? { ok: true, animation: result.animation } : { reason: result.reason });
            } else { server.game.results = results; Object.assign(outcome, { ok: true, animation: outcome.game.correct ? 'right' : 'wrong' }); }
        } else {
            const result = act(server.pal, request.action, { nowMs: now(), donuts: server.wallet });
            server.pal = strip(result.pal);
            if (result.ok) {
                Object.assign(outcome, { ok: true, animation: result.animation });
                if (result.cost) { charge(result.cost); server.wallet -= result.cost; }
            } else outcome.reason = result.reason;
        }
        return validateActReply({ outcome, duplicate: false, view: view() }, uid, request);
    },
};
window.__fakeServer = { state: server, skip: ms => { server.offset += ms; }, failNextAct: () => { server.failNextAct = true; } };
const storage = { values: new Map(), getItem(k) { return this.values.get(k) ?? null; }, setItem(k, v) { this.values.set(k, String(v)); } };
createRoot(document.getElementById('root')).render(
    <div className="max-w-md mx-auto p-4"><YumPalsDonutSaved ownerUid={UID} transport={transport} storage={storage} /></div>);
