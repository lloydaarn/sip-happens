import {Overlay} from './overlay';
import {countdown} from '../packages/timing';
import React,{useState,useEffect} from 'react';
import {createRoot} from 'react-dom/client';
declare global{interface Window{sip:{call:(action:string,data?:any)=>Promise<any>}}}
type Call=(action:string,data?:any)=>Promise<boolean>;
function Timing({data,online}:{data:any;online:boolean}){
 const labels:Record<string,string>={offline:'Paused: admin unavailable',paused:'Future reminders paused', 'outside-hours':'Waiting for active hours',snoozed:'Snoozed',pending:'Reminder pending',deferred:'Waiting for a spare monitor',scheduled:'Next reminder',due:'Reminder due'};
 const elapsed=online&&data.receivedAt?Math.max(0,Date.now()-data.receivedAt):0;
 const phase=online?data.phase:'offline';
 const milliseconds=phase==='snoozed'?data.snoozeRemainingMs:data.remainingMs;
 const timed=['snoozed','scheduled','due'].includes(phase)&&typeof milliseconds==='number';
 return <div className="timing-status"><strong>{labels[phase]||'Waiting for client status'}</strong>{timed&&<><output className="countdown">{countdown(milliseconds-elapsed)}</output><small>{phase==='snoozed'?'Returns at':'Due at'} {new Date(Date.now()+Math.max(0,milliseconds-elapsed)).toLocaleTimeString()}</small></>}{!online&&<p>All overlays are suspended until the admin connection returns.</p>}</div>;
}
function ScheduleForm({settings:s,displays=[],device,disabled=false,call}:{settings:any;displays?:any[];device?:string;disabled?:boolean;call:Call}){
 return <form onSubmit={async e=>{e.preventDefault();const f=new FormData(e.currentTarget);const spare=String(f.get('spare')||'');const settings={minutes:Number(f.get('minutes')),game:true,paused:f.has('paused'),start:Number(f.get('start')),end:Number(f.get('end')),...(spare?{spare:Number(spare)}:{})};await call(device?'manageClient':'settings',device?{device,action:'settings',settings}:settings);}}><fieldset disabled={disabled}>
  <label>Interval (minutes)<input name="minutes" type="number" min="1" max="1440" defaultValue={s.minutes} required/></label>
  <label><input name="paused" type="checkbox" defaultChecked={s.paused}/>Pause future reminders</label>
  <p>Game Mode is always on. Fullscreen apps keep their monitor; reminders use a spare display.</p>
  <label>Preferred spare display<select name="spare" defaultValue={s.spare??''}><option value="">Automatic selection</option>{displays.map((d:any)=><option key={d.id} value={d.id}>{d.label} ({d.width} × {d.height}){d.primary?' · Primary':''}</option>)}{s.spare!==undefined&&!displays.some((d:any)=>d.id===s.spare)&&<option value={s.spare}>Saved display (disconnected)</option>}</select></label>
  <p>If the preferred display is occupied or disconnected, another spare display is used. If none is spare, the reminder waits.</p>
  <p>Active hours (equal values mean all day)</p><label>Start hour<input name="start" type="number" min="0" max="23" defaultValue={s.start} required/></label><label>End hour<input name="end" type="number" min="0" max="23" defaultValue={s.end} required/></label>
  <button type="submit">Apply schedule</button>
 </fieldset></form>;
}
function PasswordForm({device,call}:{device?:string;call:Call}){
 const [current,C]=useState(''),[next,N]=useState(''),[confirm,F]=useState(''),[busy,B]=useState(false),[error,E]=useState('');
 return <form onSubmit={async e=>{e.preventDefault();if(next!==confirm){E('New passwords do not match');return;}B(true);E('');try{await call(device?'manageClient':'changePassword',device?{device,action:'password_reset',newPassword:next}:{current,next});}finally{C('');N('');F('');B(false);}}}><fieldset disabled={busy}>
  {!device&&<label>Current password<input type="password" autoComplete="current-password" value={current} onChange={e=>C(e.target.value)} maxLength={256} required/></label>}
  <label>New password<input type="password" autoComplete="new-password" value={next} onChange={e=>N(e.target.value)} minLength={10} maxLength={256} required/></label>
  <label>Confirm new password<input type="password" autoComplete="new-password" value={confirm} onChange={e=>F(e.target.value)} minLength={10} maxLength={256} required/></label>
  {error&&<p role="alert" className="error">{error}</p>}<p>Use 10–256 characters. Changing the password does not dismiss a reminder.</p><button type="submit">{busy?'Saving…':device?'Reset client password':'Change password'}</button>
 </fieldset></form>;
}
function App(){
 const [s,S]=useState<any>(),[error,E]=useState(''),[notice,T]=useState(''),[password,P]=useState(''),[host,H]=useState(''),[fingerprint,F]=useState(''),[code,C]=useState(''),[port,Q]=useState('9443');
 const overlay=new URLSearchParams(location.search).get('overlay')==='true';
 const call:Call=async(action,data)=>{try{await window.sip.call(action,data);E('');T(action==='manageClient'?'Request sent. Check Command outcomes for client acknowledgment.':action==='changePassword'?'Password changed.':'');S(await window.sip.call('state'));return true;}catch(e){E(String(e));T('');return false;}};
 useEffect(()=>{const tick=()=>window.sip.call('state').then(S).catch(e=>E(String(e)));tick();const t=setInterval(tick,1000);return()=>clearInterval(t);},[]);
 if(!s)return <main>Starting Sip Happens…</main>;
 if(overlay)return <Overlay state={s} call={async(a,d)=>{await call(a,d);}} error={error}/>;
 return <main><small>SIP HAPPENS · {s.role.toUpperCase()} · v{s.updates.version}</small><h1>Sip Happens</h1><p>Your reminders, devices and settings.</p>
 {error&&<p role="alert" className="error">{error}</p>}{notice&&<p role="status">{notice}</p>}
 {s.demo&&<section><h2>Demo active</h2><p>{s.demo.placement} · Last event: {s.demo.lastEvent}</p><p>Demo ends on disconnect or after five minutes without a demo command.</p><button onClick={()=>call('stopDemo')}>End demo and restore schedule</button></section>}
 {s.role==='client'?<>
  <section><h2>Reminder status</h2><p>{s.connected?'Admin connected':'Admin offline · all reminders paused'}</p><Timing data={s} online={s.connected}/>{!s.configured&&<form onSubmit={async e=>{e.preventDefault();await call('password',password);P('');}}><label>Create local password<input type="password" minLength={10} maxLength={256} autoComplete="new-password" value={password} onChange={e=>P(e.target.value)} required/></label><button>Save password</button></form>}{s.reminder&&<button disabled={!s.connected||s.snoozeUsed||!!s.remoteDemo} onClick={()=>call('snooze',s.reminder)}>Snooze 5 minutes</button>}{s.snoozeUsed&&<p>The five-minute snooze has been used for this reminder.</p>}</section>
  <section><h2>Schedule and display</h2>{s.paired?<><p>Controlled by your paired admin.</p><p>Interval: {s.settings.minutes} minutes · Active hours: {s.settings.start}:00–{s.settings.end}:00</p><p>Preferred display: {s.displays.find((d:any)=>d.id===s.settings.spare)?.label||(s.settings.spare===undefined?'Automatic':'Saved display is disconnected')}</p></>:<ScheduleForm key={JSON.stringify(s.settings)} settings={s.settings} displays={s.displays} disabled={!!s.demo} call={call}/>}</section>
  {s.configured&&<section><h2>Change local password</h2><PasswordForm call={call}/></section>}
  <details><summary>Pair with an admin</summary><section><p>Copy the fingerprint and a fresh pairing code directly from the admin PC.</p><label>Admin IP or hostname<input value={host} onChange={e=>H(e.target.value)}/></label><label>Port<input value={port} onChange={e=>Q(e.target.value)}/></label><label>Certificate fingerprint<input value={fingerprint} onChange={e=>F(e.target.value)}/></label><label>Pairing code<input value={code} onChange={e=>C(e.target.value)}/></label><button onClick={()=>call('pair',{host,port,fingerprint,code})}>Pair</button></section></details>
 </>:<>
  <section><h2>Connect a client</h2><p>Admin IP: {s.addresses.join(', ')||'No LAN address detected'} · Port: {s.port}</p><pre>{s.fingerprint}</pre><button onClick={()=>call('copyFingerprint')}>Copy fingerprint</button><button onClick={()=>call('pairCode')}>Generate pairing code</button><strong>{s.code}</strong><p>Codes expire after two minutes and allow one pairing.</p></section>
  {!s.devices.length&&<p>No paired clients yet.</p>}
  {s.devices.map((d:any)=><section key={d.id}><h2>{d.name}{d.demo?' (demo)':''}</h2><p>{d.connected?'Connected':'Offline'}{d.forced?' · Forced reminder':''}</p><Timing data={d} online={d.connected}/><small>Version: {d.version||'Unknown'} · Update: {d.updateStatus||'Unknown'} · Last seen: {d.lastSeen||'Waiting'}</small>
   <p><button disabled={!d.connected||!d.forceControls} onClick={()=>call('forceReminder',d.id)}>Force reminder now</button><button disabled={!d.connected||!d.reminder} onClick={()=>call('unlock',d.id)}>Unlock current reminder</button><button disabled={!d.connected||!d.managementControls||!d.reminder||d.snoozeUsed||d.demo} onClick={()=>call('manageClient',{device:d.id,action:'snooze',reminder:d.reminder,seconds:300})}>Snooze 5 minutes</button><button onClick={()=>call('revoke',d.id)}>Revoke pairing</button></p>
   {d.snoozeUsed&&<p>The five-minute snooze has been used for this reminder.</p>}
   {!d.managementControls&&<p>Update this client to enable live schedule, password, monitor and snooze controls.</p>}
   <details><summary>Schedule and preferred monitor</summary>{d.settings?<ScheduleForm key={JSON.stringify(d.settings)} settings={d.settings} displays={d.displays} device={d.id} disabled={!d.connected||!d.managementControls||d.demo} call={call}/>:<p>Waiting for the client to report its settings.</p>}</details>
   <details><summary>Reset forgotten client password</summary><p>Set a replacement password on this paired client. The old password is not required. The new password is sent over the authenticated TLS connection and is not retained by the admin.</p>{d.connected&&d.managementControls?<PasswordForm device={d.id} call={call}/>:<p>Connect an updated client to reset its password.</p>}</details>
   <details><summary>Demo controls</summary><p>End a real pending reminder before starting a demo.</p>{[['reminder','Trigger reminder now'],['fullscreen','Simulate full-screen'],['no-spare','No spare display'],['normal','Exit full-screen'],['resume','Simulate overdue resume'],['stop','End demo / restore schedule']].map(([event,label])=><button key={event} disabled={!d.connected||!d.demoControls} onClick={()=>call('demoClient',{device:d.id,event})}>{label}</button>)}<p>Fullscreen simulation occupies the first display. Trigger reminder returns to automatic detection.</p></details>
  </section>)}
  <section><h2>Command outcomes</h2>{!s.commands.length&&<p>No commands yet.</p>}{s.commands.map((c:any)=><p key={c.id}>{c.type==='manage'?({settings:'Schedule update',snooze:'Five-minute snooze',password_reset:'Password reset'} as any)[c.action]:c.type==='demo'?'Demo '+c.event:c.type==='force_reminder'?'Force reminder':'Unlock'} · {c.id.slice(0,8)} · <strong>{c.outcome}</strong>{c.reason?' · '+c.reason:''}</p>)}</section>
  <details><summary>Recent events</summary><section>{s.events.map((e:any,i:number)=><p key={i}>{e.time} · {e.message}</p>)}</section></details>
 </>}
 <details><summary>Connection diagnostics</summary><section><p><strong>{s.diagnostics.current.summary}</strong> ({s.diagnostics.current.code})</p><p>{s.diagnostics.current.hint}</p><p>Endpoint: {s.diagnostics.endpoint||'Not configured'} · Attempt: {s.diagnostics.attempt}</p><small>Last event: {s.diagnostics.current.time}{s.diagnostics.retryAt?' · Retry at '+new Date(s.diagnostics.retryAt).toLocaleTimeString():''}</small><p><button onClick={()=>call('copyDiagnostics')}>Copy diagnostic report</button>{s.role==='client'&&<button onClick={()=>call('retryConnection')}>Retry saved connection</button>}</p><p>Reports exclude passwords and credentials.</p>{s.diagnostics.history.map((d:any,i:number)=><p key={i}>{d.time} · {d.code}: {d.summary}</p>)}</section></details>
 {s.detectError&&<p className="error">{s.detectError}</p>}
 <section><h2>Updates</h2>{s.role==='admin'&&<button onClick={()=>call('forceUpdates')}>Force update admin and clients now</button>}<p>Version {s.updates.version} · {s.updates.message}</p>{s.updates.status==='downloading'&&<p>{s.updates.progress}%</p>}<button disabled={['disabled','checking','downloading','ready'].includes(s.updates.status)} onClick={()=>call('checkUpdates')}>Check for updates</button>{s.updates.status==='ready'&&<button disabled={s.role==='client'&&!!s.reminder} onClick={()=>call('installUpdate')}>Restart and install {s.updates.availableVersion}</button>}</section>
 <label><input type="checkbox" checked={s.startup} onChange={e=>call('startup',e.target.checked)}/>Launch in the tray at Windows sign-in</label>
 </main>;
}
createRoot(document.getElementById('root')!).render(<App/>);
