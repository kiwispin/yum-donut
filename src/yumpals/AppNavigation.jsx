import { useEffect, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import './appNavigation.css';

export default function AppNavigation({ activeView, children }) {
  const row = useRef(null);
  const [edges, setEdges] = useState({ left: false, right: false });
  useEffect(() => {
    const element = row.current;
    const measure = () => setEdges({ left: element.scrollLeft > 2, right: element.scrollLeft + element.clientWidth < element.scrollWidth - 2 });
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    for (const child of element.children) observer.observe(child);
    element.addEventListener('scroll', measure, { passive: true });
    measure();
    return () => { observer.disconnect(); element.removeEventListener('scroll', measure); };
  }, [children]);
  useEffect(() => {
    const element = row.current;
    const selected = element.querySelector('[aria-current="page"]');
    if (!selected) return;
    const bounds = element.getBoundingClientRect();
    const item = selected.getBoundingClientRect();
    if (item.left < bounds.left) element.scrollLeft -= bounds.left - item.left;
    else if (item.right > bounds.right) element.scrollLeft += item.right - bounds.right;
  }, [activeView, children]);
  const move = (direction) => row.current.scrollBy({ left: direction * row.current.clientWidth * 0.7, behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth' });
  return <nav className="app-navigation" aria-label="App navigation">
    <button className="app-navigation-arrow" aria-label="Show previous navigation items" disabled={!edges.left} onClick={() => move(-1)}><ChevronLeft size={18} /></button>
    <div className="app-navigation-track" ref={row}>{children}</div>
    <button className="app-navigation-arrow" aria-label="Show more navigation items" disabled={!edges.right} onClick={() => move(1)}><ChevronRight size={18} /></button>
  </nav>;
}
