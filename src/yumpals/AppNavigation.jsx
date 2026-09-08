import { Children, cloneElement, useEffect, useId, useRef, useState } from 'react';
import { ChevronDown } from 'lucide-react';
import './appNavigation.css';

export default function AppNavigation({ activeView, children }) {
  const [open, setOpen] = useState(false);
  const root = useRef(null);
  const trigger = useRef(null);
  const panelId = useId();
  const items = Children.toArray(children);
  const primary = item => ['give', 'yumpals', 'yumpals-saved'].includes(item.props['data-nav-id']);
  const secondary = items.filter(item => !primary(item));
  const selected = secondary.find(item => item.props['aria-current'] === 'page');
  useEffect(() => {
    if (!open) return;
    const outside = event => { if (!root.current?.contains(event.target)) setOpen(false); };
    const escape = event => { if (event.key === 'Escape') { setOpen(false); trigger.current?.focus(); } };
    document.addEventListener('pointerdown', outside);
    document.addEventListener('keydown', escape);
    return () => { document.removeEventListener('pointerdown', outside); document.removeEventListener('keydown', escape); };
  }, [open]);
  const pick = item => cloneElement(item, { onClick: event => { const menu = event.currentTarget.closest('nav')?.querySelector('.app-navigation-menu'); item.props.onClick?.(event); setOpen(false); if (!primary(item)) menu?.focus(); } });
  return <nav className="app-navigation" aria-label="App navigation" ref={root}>
    {items.filter(primary).map(pick)}
    <button type="button" ref={trigger} className={`app-navigation-menu ${selected ? 'is-current' : ''}`} aria-expanded={open} aria-controls={panelId} onClick={() => setOpen(!open)}>
      Menu <ChevronDown size={16} className={open ? 'is-open' : ''} />
    </button>
    {selected && <span className="app-navigation-current" aria-live="polite">{activeView === 'yumpals-preview' ? 'Preview' : activeView}</span>}
    {open && <div className="app-navigation-panel" id={panelId}>
      <p className="app-navigation-caption">Explore YumDonut</p>
      <div className="app-navigation-grid">{secondary.map(pick)}</div>
    </div>}
  </nav>;
}
