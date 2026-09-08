export function ignoreHandheldKey(event) {
  if (event.repeat || event.ctrlKey || event.metaKey || event.altKey) return true;
  const target = event.target;
  if (target?.isContentEditable || target?.closest?.('input,select,textarea,[contenteditable="true"]')) return true;
  const button = target?.closest?.('button');
  // Keep native Enter/Space activation and leave unrelated page controls alone.
  if (button && (!button.closest('.paid-demo-device') || ['Enter', ' '].includes(event.key))) return true;
  return false;
}
