import React from 'react';
import { pixelPaths } from './pixelPaths.js';

export default function PixelDrawing({ pixels, palette }) {
  return <svg aria-hidden="true" focusable="false" viewBox={`0 0 ${pixels[0].length} ${pixels.length}`}
    preserveAspectRatio="none" shapeRendering="crispEdges"
    style={{ width: '100%', height: '100%', display: 'block', gridColumn: '1 / -1', gridRow: '1 / -1' }}>
    {pixelPaths(pixels).map(([cell, d]) => palette[cell] && <path key={cell} d={d} fill={palette[cell]} />)}
  </svg>;
}
