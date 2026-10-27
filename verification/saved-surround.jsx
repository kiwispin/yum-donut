import React from 'react';
import {createRoot} from 'react-dom/client';
import Saved from '../src/yumpals/YumPalsSavedHandheld.jsx';
import quote from './saved-surround-quote.json';
import '../src/index.css';
import '../src/yumpals/appSurround.css';
const getIdentity = () => ({uid:'student-a',isAnonymous:false,sandbox:false});
// ?cheer=1 (or ?cheer=0 for full happiness) adds today's giving cheer to the reply.
const cheerGain = new URLSearchParams(window.location.search).get('cheer');
const transport = async name => { if(name !== 'yumpalsGetPaidCareState') throw Error('No purchases in styling fixture');
  const view = structuredClone(quote); if (cheerGain !== null) view.cheer = {date: view.aucklandDate, gain: Number(cheerGain)}; return view; };
const storage = {getItem:()=>null,setItem:()=>{},removeItem:()=>{}};
createRoot(document.getElementById('root')).render(<div className="max-w-md md:max-w-2xl mx-auto p-4 yumpals-embedded-saved"><Saved ownerUid="student-a" projectId="demo-style" enabled getIdentity={getIdentity} transport={transport} storage={storage}/></div>);
