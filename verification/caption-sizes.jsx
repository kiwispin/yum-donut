// Every caption the Donut pal can show, each in the real caption box, inside the
// same page width as the app, so verification/caption-sizes-check.mjs can measure them.
import React from 'react';
import { createRoot } from 'react-dom/client';
import '@fontsource/baloo-2/latin-500.css';
import '@fontsource/baloo-2/latin-700.css';
import '../src/yumpals/donutPal.css';
import { allCaptions } from '../src/yumpals/donutUi.js';
import { ICON_LABELS } from '../src/yumpals/donutPalArt.js';
import '../src/index.css';

const icons = new Set(Object.values(ICON_LABELS));
createRoot(document.getElementById('root')).render(
    <div className="max-w-md mx-auto p-4">
        <section className="donut-pal">
            {allCaptions().map(text => <p key={text} className={`donut-caption${icons.has(text) ? ' is-pick' : ''}`}>{text}</p>)}
        </section>
    </div>);
