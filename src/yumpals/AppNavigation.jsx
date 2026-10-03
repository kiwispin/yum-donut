import { Children, cloneElement, useEffect, useLayoutEffect, useId, useRef, useState } from 'react';
import { BriefcaseBusiness, Check, ChevronDown, Flag, Gamepad2, Gift, GraduationCap, Landmark, MessageCircle, ShoppingBag, Sparkles, Trophy } from 'lucide-react';
import './appNavigation.css';

const ORDER = ['give', 'goal', 'feed', 'arcade', 'bank', 'shop', 'jobs', 'leaderboard', 'yumpals', 'yumpals-saved', 'training', 'yumpals-preview'];
const MORE_ONLY = new Set(['yumpals', 'yumpals-saved', 'training', 'yumpals-preview']);
const ICONS = { give: Gift, goal: Flag, yumpals: Sparkles, 'yumpals-saved': Sparkles, 'yumpals-preview': Sparkles, arcade: Gamepad2, bank: Landmark, shop: ShoppingBag, jobs: BriefcaseBusiness, training: GraduationCap, feed: MessageCircle, leaderboard: Trophy };

export default function AppNavigation({ activeView, children }) {
  const [open, setOpen] = useState(false);
  const [visibleCount, setVisibleCount] = useState(0);
  const root = useRef(null);
  const trigger = useRef(null);
  const panel = useRef(null);
  const measureRow = useRef(null);
  const focusOnOpen = useRef(null);
  const focusAfterResize = useRef(null);
  const measuredCount = useRef(0);
  const panelId = useId();
  const rank = item => { const index = ORDER.indexOf(item.props['data-nav-id']); return index < 0 ? ORDER.length : index; };
  const candidates = Children.toArray(children).sort((a, b) => rank(a) - rank(b));
  const stripCandidates = candidates.filter(item => !MORE_ONLY.has(item.props['data-nav-id']));
  const moreOnly = candidates.filter(item => MORE_ONLY.has(item.props['data-nav-id']));
  const primary = stripCandidates.slice(0, visibleCount);
  const secondary = [...stripCandidates.slice(visibleCount), ...moreOnly];
  const hasMoreOnly = moreOnly.length > 0;
  const selected = secondary.find(item => item.props['aria-current'] === 'page');
  const signature = candidates.map(item => item.props['data-nav-id']).join('|');

  useLayoutEffect(() => {
    const measure = () => {
      if (!root.current || !measureRow.current) return;
      const measured = [...measureRow.current.children];
      const moreWidth = measured.pop().getBoundingClientRect().width;
      const widths = measured.map(item => item.getBoundingClientRect().width);
      const gap = parseFloat(getComputedStyle(root.current).columnGap) || 0;
      const available = root.current.clientWidth;
      const total = widths.reduce((sum, width) => sum + width, 0) + Math.max(0, widths.length - 1) * gap;
      const applyCount = count => {
        if (count !== measuredCount.current && root.current.contains(document.activeElement)) {
          focusAfterResize.current = document.activeElement.dataset.navId || 'more';
        }
        measuredCount.current = count;
        setVisibleCount(count);
      };
      if (!hasMoreOnly && total <= available) { applyCount(widths.length); return; }
      let used = moreWidth;
      let count = 0;
      for (const width of widths) {
        if (used + gap + width > available) break;
        used += gap + width;
        count++;
      }
      applyCount(count);
    };
    const observer = new ResizeObserver(measure);
    observer.observe(root.current);
    observer.observe(measureRow.current);
    measure();
    return () => observer.disconnect();
  }, [children, hasMoreOnly]);

  useLayoutEffect(() => {
    if (!focusAfterResize.current) return;
    const buttons = [...root.current.querySelectorAll(':scope > button, .app-navigation-panel > button')];
    const target = buttons.find(button => button.dataset.navId === focusAfterResize.current)
      || trigger.current || buttons.find(button => button.getAttribute('aria-current') === 'page') || buttons[0];
    focusAfterResize.current = null;
    target?.focus();
  }, [visibleCount]);

  const close = (restoreFocus = false) => {
    setOpen(false);
    focusOnOpen.current = null;
    if (restoreFocus) trigger.current?.focus();
  };
  useEffect(() => { setOpen(false); focusOnOpen.current = null; }, [activeView, signature]);
  useLayoutEffect(() => {
    if (!secondary.length && open) {
      const focusedId = document.activeElement?.dataset.navId;
      setOpen(false);
      const buttons = [...root.current.querySelectorAll(':scope > button')];
      (buttons.find(button => button.dataset.navId === focusedId || button.getAttribute('aria-current') === 'page') || buttons[0])?.focus();
    }
  }, [secondary.length, open]);
  useEffect(() => {
    if (!open) return undefined;
    const outside = event => { if (!root.current?.contains(event.target)) close(); };
    const escape = event => { if (event.key === 'Escape') { event.preventDefault(); close(true); } };
    document.addEventListener('pointerdown', outside);
    document.addEventListener('keydown', escape);
    return () => { document.removeEventListener('pointerdown', outside); document.removeEventListener('keydown', escape); };
  }, [open]);
  useLayoutEffect(() => {
    if (!open || !focusOnOpen.current) return;
    const buttons = [...panel.current.querySelectorAll('button:not(:disabled)')];
    (focusOnOpen.current === 'last' ? buttons.at(-1) : buttons[0])?.focus();
    focusOnOpen.current = null;
  }, [open]);

  const triggerKey = event => {
    if (!['ArrowDown', 'ArrowUp'].includes(event.key)) return;
    event.preventDefault();
    if (open) {
      const buttons = [...panel.current.querySelectorAll('button:not(:disabled)')];
      (event.key === 'ArrowUp' ? buttons.at(-1) : buttons[0])?.focus();
    } else { focusOnOpen.current = event.key === 'ArrowUp' ? 'last' : 'first'; setOpen(true); }
  };
  const panelKey = event => {
    if (!['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) return;
    const buttons = [...panel.current.querySelectorAll('button:not(:disabled)')];
    if (!buttons.length) return;
    event.preventDefault();
    const index = buttons.indexOf(document.activeElement);
    const next = event.key === 'Home' ? 0 : event.key === 'End' ? buttons.length - 1 : (index + (event.key === 'ArrowDown' ? 1 : -1) + buttons.length) % buttons.length;
    buttons[next].focus();
  };
  const pick = (item, inOverflow = false) => {
    const Icon = ICONS[item.props['data-nav-id']] || Sparkles;
    return cloneElement(item, {
      className: inOverflow ? 'app-navigation-item' : 'app-navigation-link',
      onClick: event => {
        const menuButton = event.currentTarget.closest('nav')?.querySelector('.app-navigation-menu');
        item.props.onClick?.(event);
        setOpen(false);
        if (inOverflow) menuButton?.focus();
      },
      children: inOverflow ? <><Icon className="app-navigation-item-icon" size={18} aria-hidden="true" /><span className="app-navigation-item-label">{item.props.children}</span>{item.props['aria-current'] === 'page' && <Check className="app-navigation-check" size={16} aria-hidden="true" />}</> : item.props.children,
    });
  };
  return <nav className="app-navigation" aria-label="App navigation" ref={root} onBlur={event => { if (!event.currentTarget.contains(event.relatedTarget)) close(); }}>
    {primary.map(item => pick(item))}
    {secondary.length > 0 && <div className="app-navigation-overflow">
      <button type="button" ref={trigger} className={`app-navigation-menu ${selected ? 'is-current' : ''}`} aria-expanded={open} aria-controls={panelId} onKeyDown={triggerKey} onClick={() => setOpen(value => !value)}>
        More <ChevronDown size={16} aria-hidden="true" className={open ? 'is-open' : ''} />
      </button>
      {selected && <span className="sr-only" aria-live="polite">Current page: {activeView === 'yumpals-preview' ? 'YumPals preview' : activeView}</span>}
      {open && <div className="app-navigation-panel" id={panelId} ref={panel} onKeyDown={panelKey}>{secondary.map(item => pick(item, true))}</div>}
    </div>}
    <div className="app-navigation-measure" ref={measureRow} aria-hidden="true" inert>
      {stripCandidates.map(item => cloneElement(item, { className: 'app-navigation-link', tabIndex: -1 }))}
      <span className="app-navigation-menu">More <ChevronDown size={16} aria-hidden="true" /></span>
    </div>
  </nav>;
}
