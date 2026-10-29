import React from 'react';
import { createRoot } from 'react-dom/client';
import DonutPreview from '../src/yumpals/YumPalsDonutPreview.jsx';
import '../src/index.css';
createRoot(document.getElementById('root')).render(<div className="max-w-md mx-auto p-4"><DonutPreview /></div>);
