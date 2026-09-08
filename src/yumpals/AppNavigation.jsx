import { Children, cloneElement, useEffect, useLayoutEffect, useId, useRef, useState } from 'react';
import { ChevronDown } from 'lucide-react';
import './appNavigation.css';

export default function AppNavigation({ activeView, children }) {
  const [open, setOpen] = useState(false);
  const root = useRef(null);
  const trigger = useRef(null);
  const panelId = useId();
  const measureRow = useRef(null);
  const [visibleCount, setVisibleCount] = useState(0);
  const items = Children.toArray(children);
  const order = ['give', 'goal', 'yumpals', 'yumpals-saved', 'arcade', 'bank', 'shop'];
  const candidates = items.filter(item => order.includes(item.props['data-nav-id'])).sort((a,b) => order.indexOf(a.props['data-nav-id']) - order.indexOf(b.props['data-nav-id']));
  const visibleIds = candidates.slice(0, visibleCount).map(item => item.props['data-nav-id']);
  const primary = item => visibleIds.includes(item.props['data-nav-id']);
  useLayoutEffect(() => {
    const measure = () => {
      const available = root.current.clientWidth - trigger.current.getBoundingClientRect().width - 4;
      let used = 0; let count = 0;
      for (const item of measureRow.current.children) {
        used += item.getBoundingClientRect().width + 4;
        if (used > available) break;
        count++;
      }
      setVisibleCount(count);
    };
    const observer = new ResizeObserver(measure);
    observer.observe(root.current); observer.observe(measureRow.current);
    measure();
    return () => observer.disconnect();
  }, [children]);
  const secondary = [...candidates.filter(item => !primary(item)), ...items.filter(item => !order.includes(item.props['data-nav-id']))];
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
    {candidates.filter(primary).map(pick)}
    <button type="button" ref={trigger} className={`app-navigation-menu ${selected ? 'is-current' : ''}`} aria-expanded={open} aria-controls={panelId} onClick={() => setOpen(!open)}>
      More <ChevronDown size={16} className={open ? 'is-open' : ''} />
    </button>
    {selected && <span className="sr-only" aria-live="polite">Current page: {activeView === 'yumpals-preview' ? 'Preview' : activeView}</span>}
    {open && <div className="app-navigation-panel" id={panelId}>
      <p className="app-navigation-caption">Explore YumDonut</p>
      <div className="app-navigation-grid">{secondary.map(pick)}</div>
    </div>}
    <div className="app-navigation-measure" ref={measureRow} aria-hidden="true" inert>{candidates.map(item => cloneElement(item, { tabIndex: -1 }))}</div>
  </nav>;
}
