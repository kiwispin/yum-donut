// Preview-only clock in minutes; never writes a saved pet or a wallet.
export function advancePreviewNeeds(needs, previous, minutes) {
  const next = { ...needs };
  const clock = { hunger: 0, happiness: 0, cleanliness: 0, health: 0, ...previous };
  const periods = { hunger: 480, happiness: 720, cleanliness: 1440 };
  let left = minutes;
  while (left > 0) {
    const unhealthy = next.hunger === 0 || next.cleanliness === 0;
    if (!unhealthy) clock.health = 0;
    const step = Math.min(left, ...Object.entries(periods).map(([key, period]) => period - clock[key]), unhealthy ? 1440 - clock.health : Infinity);
    for (const [key, period] of Object.entries(periods)) {
      clock[key] += step;
      if (clock[key] >= period) { next[key] = Math.max(0, next[key] - 1); clock[key] = 0; }
    }
    if (unhealthy) { clock.health += step; if (clock.health >= 1440) { next.health = Math.max(0, next.health - 1); clock.health = 0; } }
    left -= step;
  }
  return { needs: next, clock };
}
