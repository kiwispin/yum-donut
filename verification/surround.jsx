import React from 'react';
import { createRoot } from 'react-dom/client';
import YumPalsHandheldDemo from '../src/yumpals/YumPalsHandheldDemo.jsx';
import '../src/index.css';
import '../src/yumpals/appSurround.css';
createRoot(document.getElementById('root')).render(<div className="max-w-md md:max-w-2xl mx-auto p-4 yumpals-embedded-preview"><YumPalsHandheldDemo /></div>);
