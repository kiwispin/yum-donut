const shapes = new WeakMap();

// Cache one path per palette colour, preserving exact pixel boundaries.
export function pixelPaths(pixels) {
  if (shapes.has(pixels)) return shapes.get(pixels);
  const groups = new Map();
  pixels.forEach((row, y) => {
    for (let x = 0; x < row.length;) {
      const cell = row[x]; let end = x + 1;
      while (end < row.length && row[end] === cell) end++;
      const length = end - x;
      groups.set(cell, (groups.get(cell) || '') + `M${x} ${y}h${length}v1h-${length}z`);
      x = end;
    }
  });
  const result = [...groups]; shapes.set(pixels, result); return result;
}
