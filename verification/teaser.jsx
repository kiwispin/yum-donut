// Teaser card for the Donut pal launch (a 1200x675 image for a Teams post).
// Shows the real handheld with a cracking egg. Render: node verification/teaser-shot.mjs
import React from 'react';
import { createRoot } from 'react-dom/client';
import DonutDevice from '../src/yumpals/DonutDevice.jsx';
import { createDonutPal } from '../src/yumpals/donutPal.js';
import { animationFrames } from '../src/yumpals/donutPalArt.js';
import '../src/index.css';

const egg = createDonutPal({ name: 'Pal', nowMs: Date.now() });
const cracking = animationFrames(egg, 'hatched')[6];
const noop = () => {};
const css = `
.teaser { width: 1200px; height: 675px; box-sizing: border-box; display: grid; grid-template-columns: 1fr 560px; align-items: center;
  padding: 0 64px; background: radial-gradient(circle at 75% 45%, #ffe3ec 0, #fdf6ec 55%); font-family: inherit; overflow: hidden; }
.teaser .donut-pal { --d: 500px; padding: 0; }
.teaser .donut-pal-name, .teaser .donut-caption { display: none; }
.teaser .donut-led.is-on { animation: none; }
.teaser .donut-icon { opacity: 0.25; }
.teaser h1 { font-size: 64px; line-height: 1.02; font-weight: 900; color: #3b2f45; margin: 0 0 22px; letter-spacing: -0.02em; }
.teaser h1 span { color: #e64980; }
.teaser p { font-size: 25px; line-height: 1.4; color: #5c4b66; margin: 0 0 16px; max-width: 520px; }
.teaser .tag { display: inline-block; background: #3b2f45; color: #fff; font-weight: 800; font-size: 18px; letter-spacing: 0.12em;
  text-transform: uppercase; padding: 8px 16px; border-radius: 999px; margin-bottom: 26px; }
.teaser .when { font-weight: 800; color: #3b2f45; }
`;
createRoot(document.getElementById('root')).render(
    <div className="teaser">
        <style>{css}</style>
        <div>
            <div className="tag">YumPals</div>
            <h1>Something’s <span>hatching</span> on Monday…</h1>
            <p>Your YumPal is moving into a brand-new pocket Donut. Free care, cupcake treats, and a pal that grows up with you.</p>
            <p className="when">Open YumPals on Monday and watch yours hatch.</p>
        </div>
        <DonutDevice name="Pal" glaze="berry" rows={cracking} describe="A cracking egg" attention selectedIcon={-1}
            help={['A', 'B', 'C']} caption="" sound={false} onPress={noop} onPick={noop} onToggleSound={noop} />
    </div>);
