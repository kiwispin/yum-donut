import React, { useState } from 'react';
import { createRoot } from 'react-dom/client';
import { useSavedVisibility } from '../src/yumpals/useSavedVisibility.js';
let enabled = false;
const transport = async (_name, _data, context) => ({schemaVersion:1,ownerUid:context.ownerUid,enabled});
function Fixture() {
 const [preview,setPreview] = useState(false);
 const visible = useSavedVisibility({eligible:true,uid:'fixture',transport,refreshKey:false});
 return <><button onClick={()=>{enabled=!enabled;window.dispatchEvent(new Event('yumpals-settings-confirmed'));}}>Toggle saved setting</button><button onClick={()=>setPreview(!preview)}>Toggle preview</button>{visible && <p>Saved activity visible</p>}{preview && <p>Preview activity visible</p>}</>;
}
createRoot(document.getElementById('root')).render(<Fixture />);
