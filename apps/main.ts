import {app,BrowserWindow,ipcMain,screen,powerMonitor,Tray,Menu,nativeImage,safeStorage,dialog,clipboard} from 'electron';
import {readFileSync,writeFileSync,renameSync,existsSync} from 'node:fs';
import {join} from 'node:path';
import {randomUUID,randomBytes,X509Certificate} from 'node:crypto';
import {createServer} from 'node:https';
import {hostname,networkInterfaces} from 'node:os';
import {execFile} from 'node:child_process';
import {WebSocket,WebSocketServer} from 'ws';
import selfsigned from 'selfsigned';
import {z} from 'zod';
import {Reminder,Settings,defaults,hashPassword,verifyPassword,targets} from '../packages/core';
import {DemoSession} from '../packages/demo';
import {autoUpdater} from 'electron-updater';
import {setupUpdates} from './updates';
declare const APP_ROLE:string;
const demoMode=process.argv.includes('--demo');
const admin=APP_ROLE==='admin';
app.setName(`Sip Happens ${APP_ROLE}`);app.setPath('userData',join(app.getPath('appData'),`sip-happens-${APP_ROLE}${demoMode?'-demo':''}`));
if(!app.requestSingleInstanceLock())app.quit();else app.whenReady().then(start).catch(()=>{dialog.showErrorBox('Sip Happens could not start','Unable to load saved settings or Windows-protected credentials. Your data has been preserved. See README troubleshooting for recovery.');app.exit(1);});
async function start(){
 const file=join(app.getPath('userData'),'state.json');
 let db:any=existsSync(file)?JSON.parse(readFileSync(file,'utf8')):{id:randomUUID(),settings:defaults,state:{due:Date.now()+7200000},devices:{},events:[]};
 const save=()=>{writeFileSync(file+'.tmp',JSON.stringify(db));renameSync(file+'.tmp',file);};
 const seal=(x:unknown)=>{if(!safeStorage.isEncryptionAvailable())throw Error('Windows secret storage unavailable');return safeStorage.encryptString(JSON.stringify(x)).toString('base64');};
 const unseal=(x:string)=>JSON.parse(safeStorage.decryptString(Buffer.from(x,'base64')));
 const model=new Reminder(db.state,Settings.parse(db.settings));
 const demo=demoMode&&!admin?new DemoSession(model):undefined;
 demo?.apply('reset',Date.now());
 let main:BrowserWindow, socket:WebSocket|undefined,connected=false,occupied:number[]=[],detectError='',deferred=false,quitting=false,failUntil=0,passwordBusy=false,backoff=1000;
 const overlays=new Map<number,BrowserWindow>(),sessions=new Map<string,WebSocket>(),statuses=new Map<string,any>(),seen=new Set<string>(),commands=new Map<string,any>();
 let code='',codeUntil=0,pairAttempts=0,fingerprint='';
 const event=(message:string)=>{db.events=[{time:new Date().toISOString(),message},...db.events].slice(0,200);save();};
 const persist=()=>{db.state=model.state;db.settings=model.settings;save();};
 const updates=setupUpdates(autoUpdater,app.getVersion(),app.isPackaged&&!demoMode,()=>admin||!model.state.reminder,()=>{quitting=true;});
 const loginOptions={path:process.execPath,args:['--startup']};
 if(app.isPackaged&&!demoMode&&app.getLoginItemSettings().openAtLogin)app.setLoginItemSettings({...loginOptions,openAtLogin:true});
 const state=()=>({updates:updates.state,startup:app.getLoginItemSettings(loginOptions).openAtLogin,addresses:Object.values(networkInterfaces()).flat().filter(a=>a&&!a.internal&&a.family==='IPv4').map(a=>a!.address),demo:demo?{placement:demo.placement,offline:demo.offline,graceUntil:demo.graceUntil,lastEvent:demo.lastEvent}:null,role:APP_ROLE,configured:!!db.password,connected,device:db.id,reminder:model.state.reminder,due:model.state.due,settings:model.settings,deferred,detectError,displays:screen.getAllDisplays().map(d=>({id:d.id,label:d.label})),fingerprint,code:Date.now()<codeUntil?code:'',port:db.port||9443,devices:Object.entries(db.devices).map(([id,v]:[string,any])=>({id,name:v.name,connected:sessions.has(id),...statuses.get(id)})),commands:[...commands.values()].slice(-30),events:db.events});
 const makeWindow=(overlay=false,bounds?:Electron.Rectangle)=>{const w=new BrowserWindow({width:960,height:800,...bounds,show:false,frame:!overlay,alwaysOnTop:overlay,skipTaskbar:overlay,resizable:!overlay,webPreferences:{preload:join(__dirname,'preload.cjs'),sandbox:true,contextIsolation:true,nodeIntegration:false}});w.setMenu(null);w.webContents.setWindowOpenHandler(()=>({action:'deny'}));w.webContents.on('will-navigate',e=>e.preventDefault());w.loadFile(join(__dirname,'index.html'),{query:{overlay:String(overlay)}});w.once('ready-to-show',()=>{if(!overlay&&process.argv.includes('--startup'))return;overlay&&model.settings.game?w.showInactive():w.show();});w.on('close',e=>{if(!quitting){e.preventDefault();if(!overlay)w.hide();}});return w;};
 const report=()=>{if(socket?.readyState===WebSocket.OPEN&&connected)socket.send(JSON.stringify({type:'status',demo:!!demo,reminder:model.state.reminder,deferred,game:model.settings.game,settings:model.settings}));};
 const render=()=>{const ds=screen.getAllDisplays();const ids=model.state.reminder?targets(ds.map(d=>d.id),demo?demo.occupied(ds.map(d=>d.id)):occupied,model.settings.game,model.settings.spare):[];deferred=!!model.state.reminder&&!ids.length;for(const [id,w] of overlays)if(!ids.includes(id)){w.destroy();overlays.delete(id);}for(const id of ids){const bounds=ds.find(d=>d.id===id)!.bounds;if(!overlays.has(id))overlays.set(id,makeWindow(true,bounds));else overlays.get(id)!.setBounds(bounds);}persist();report();};
 const send=(ws:WebSocket,x:unknown)=>ws.send(JSON.stringify(x));
 if(admin){
  if(!db.tls){const cert=await selfsigned.generate([{name:'commonName',value:'Sip Happens'}],{days:3650,keySize:2048});db.tls=seal({key:cert.private,cert:cert.cert});save();}
  const tls=unseal(db.tls);fingerprint=new X509Certificate(tls.cert).fingerprint256;
  const server=createServer(tls);const wss=new WebSocketServer({server,maxPayload:16384});
  wss.on('connection',ws=>{let identity='';const timeout=setTimeout(()=>ws.close(),10000);ws.on('message',buffer=>{try{const m=JSON.parse(buffer.toString());if(!identity){if(m.type==='pair'){if(++pairAttempts>10||Date.now()>codeUntil||m.code!==code||typeof m.name!=='string')return ws.close();identity=randomUUID();const token=randomBytes(32).toString('hex');db.devices[identity]={name:m.name.slice(0,100),secret:seal(token)};codeUntil=0;event('Device paired');send(ws,{type:'paired',device:identity,token});}else if(m.type==='auth'&&typeof m.device==='string'&&db.devices[m.device]&&m.token===unseal(db.devices[m.device].secret)){identity=m.device;send(ws,{type:'authenticated'});}else return ws.close();clearTimeout(timeout);sessions.get(identity)?.close();sessions.set(identity,ws);return;}if(m.type==='status'){statuses.set(identity,{demo:m.demo===true,reminder:typeof m.reminder==='string'?m.reminder:undefined,deferred:m.deferred===true,game:m.game===true,lastSeen:new Date().toISOString()});}if(m.type==='ack'){const c=commands.get(m.id);if(c&&c.device===identity&&c.reminder===m.reminder&&c.outcome==='pending'){c.outcome=m.outcome==='acknowledged'?'acknowledged':'rejected';event('Unlock '+c.outcome);}}}catch{ws.close();}});ws.on('close',()=>{clearTimeout(timeout);if(sessions.get(identity)===ws){sessions.delete(identity);for(const c of commands.values())if(c.device===identity&&c.outcome==='pending')c.outcome='disconnected';}});ws.on('error',()=>{});});
  server.on('error',e=>{detectError=e.message;});server.listen(db.port||9443,'0.0.0.0');
 }else{
  const connect=(pair?:any)=>{if(demo?.offline)return;const p=pair|| (db.pair?unseal(db.pair):null);if(!p)return;socket?.removeAllListeners();socket?.close();connected=false;const ws=socket=new WebSocket(`wss://${p.host}:${p.port}`,{rejectUnauthorized:false,maxPayload:16384,handshakeTimeout:10000});
   ws.on('open',()=>{const cert=(ws as any)._socket.getPeerCertificate();if(cert.fingerprint256?.replaceAll(':','').toLowerCase()!==p.fingerprint.replaceAll(':','').toLowerCase()){detectError='Certificate fingerprint mismatch';ws.close();return;}send(ws,pair?{type:'pair',code:p.code,name:hostname()}:{type:'auth',device:p.device,token:p.token});});
   ws.on('message',async buffer=>{try{const m=JSON.parse(buffer.toString());if(m.type==='paired'&&pair){db.id=m.device;db.pair=seal({...p,code:undefined,device:m.device,token:m.token});save();connected=true;backoff=1000;report();}else if(m.type==='authenticated'){connected=true;backoff=1000;report();}else if(connected&&m.type==='unlock'){const outcome=model.command(m,db.id,Date.now(),seen);render();send(ws,{type:'ack',id:m.id,reminder:m.reminder,outcome});}else if(connected&&m.type==='settings'){model.settings=Settings.parse(m.settings);if(model.settings.game)occupied=screen.getAllDisplays().map(d=>d.id);render();}}catch{ws.close();}});
   ws.on('error',()=>{detectError='Admin unavailable or pairing failed';});ws.on('close',()=>{connected=false;if(db.pair){setTimeout(()=>connect(),backoff);backoff=Math.min(backoff*2,30000);}});
  };(globalThis as any).pair=connect;connect();
 }
 main=makeWindow();app.on('second-instance',()=>main.show());app.on('before-quit',()=>{quitting=true;});
 const tray=new Tray(nativeImage.createFromDataURL('data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII='));tray.setToolTip('Sip Happens');tray.setContextMenu(Menu.buildFromTemplate([{label:'Open Sip Happens',click:()=>main.show()},{label:'Exit',click:()=>{if(admin||!model.state.reminder)app.quit();}}]));tray.on('double-click',()=>main.show());
 ipcMain.handle('sip',async(e,action,data)=>{if(!BrowserWindow.fromWebContents(e.sender)||e.senderFrame!==e.sender.mainFrame)throw Error('Unauthorized sender');const isOverlay=[...overlays.values()].some(w=>w.webContents===e.sender);if(isOverlay&&!['state','password',...(demo?['demo']:[])].includes(action))throw Error('Not permitted');
  if(action==='state')return state();
  if(action==='launchDemo'&&!admin&&!demoMode){const {spawn}=await import('node:child_process');const child=spawn(process.execPath,[...(app.isPackaged?[]:[join(__dirname,'client.cjs')]),'--demo'],{detached:true,stdio:'ignore',env:{...process.env,ELECTRON_RUN_AS_NODE:undefined}});child.unref();return;}
  if(action==='demo'&&demo){
    const wasOffline=demo.offline;
    demo.apply(data,Date.now());
    if(demo.offline){connected=false;socket?.terminate();}
    else if(wasOffline)(globalThis as any).pair();
    render();return;
  }
  if(action==='password'&&!admin){if(passwordBusy||Date.now()<failUntil)throw Error('Please wait before trying again');const password=z.string().max(256).parse(data);passwordBusy=true;try{if(!db.password){db.password=await hashPassword(password);persist();}else if(await verifyPassword(password,db.password)){model.unlock(model.state.reminder!,Date.now());render();}else{failUntil=Date.now()+3000;throw Error('Incorrect password');}}finally{passwordBusy=false;}return;}
  if(action==='pair'&&!admin){const p=z.object({host:z.string().regex(/^[a-zA-Z0-9.-]+$/),port:z.coerce.number().int().min(1).max(65535),fingerprint:z.string().regex(/^(?:[a-fA-F0-9]{2}:?){32}$/),code:z.string().length(6)}).parse(data);(globalThis as any).pair(p);return;}
  if(action==='pairCode'&&admin){code=String(100000+randomBytes(4).readUInt32BE()%900000);codeUntil=Date.now()+120000;pairAttempts=0;return;}
  if(action==='unlock'&&admin){const id=z.string().uuid().parse(data);const st=statuses.get(id);if(!st?.reminder||!sessions.has(id))throw Error('No connected pending reminder');const c={type:'unlock',id:randomUUID(),device:id,reminder:st.reminder,expires:Date.now()+15000,outcome:'pending'};commands.set(c.id,c);send(sessions.get(id)!,c);setTimeout(()=>{if(c.outcome==='pending')c.outcome='expired';},15000);return;}
  if(action==='revoke'&&admin){const id=z.string().uuid().parse(data);delete db.devices[id];sessions.get(id)?.close();event('Device revoked');return;}
  if(action==='settings'){if(admin){const id=z.string().uuid().parse(data.device);if(!sessions.has(id))throw Error('Client offline');send(sessions.get(id)!,{type:'settings',settings:Settings.parse(data.settings)});}else{if(db.pair)throw Error('Paired schedules are controlled by the admin');model.settings=Settings.parse(data);if(model.settings.game)occupied=screen.getAllDisplays().map(d=>d.id);render();}return;}
  if(action==='copyFingerprint'&&admin){clipboard.writeText(fingerprint);return;}
  if(action==='checkUpdates'){await updates.check();return;}
  if(action==='installUpdate'){updates.install();return;}
  if(action==='startup'){if(demoMode||!app.isPackaged)throw Error('Enable startup in the installed app');app.setLoginItemSettings({...loginOptions,openAtLogin:z.boolean().parse(data)});return;}
  throw Error('Unknown action');
 });
 let elapsed=performance.now(),wall=Date.now(),grace=0;powerMonitor.on('resume',()=>{elapsed=performance.now();wall=Date.now();grace=Date.now()+15000;});
 setInterval(()=>{if(!admin&&db.password){const now=performance.now();wall+=now-elapsed;elapsed=now;if(Date.now()>Math.max(grace,demo?.graceUntil||0)){const before=model.state.reminder;model.tick(wall,new Date().getHours());if(before!==model.state.reminder)render();}tray.setToolTip(model.state.reminder?'Sip Happens: reminder pending':`Sip Happens: next ${new Date(model.state.due).toLocaleTimeString()}`);}report();},1000);
 let detecting=false,candidate='',stable=0;
 if(!admin)setInterval(()=>{if(demo||detecting||!model.settings.game)return;detecting=true;execFile('powershell.exe',['-NoProfile','-ExecutionPolicy','Bypass','-File',(app.isPackaged?join(process.resourcesPath,'detect.ps1'):join(__dirname,'detect.ps1')),String(process.pid)],{timeout:8000,windowsHide:true},(err,out)=>{detecting=false;if(err){detectError='Full-screen detection unavailable; reminders deferred in Game Mode';occupied=screen.getAllDisplays().map(d=>d.id);render();return;}try{const rects=JSON.parse(out.trim()||'[]');const ids=screen.getAllDisplays().filter(d=>rects.some((r:any)=>{const b=screen.screenToDipRect(null,r);return Math.abs(b.x-d.bounds.x)<4&&Math.abs(b.y-d.bounds.y)<4&&Math.abs(b.width-d.bounds.width)<4&&Math.abs(b.height-d.bounds.height)<4;})).map(d=>d.id);const key=ids.join();if(key!==candidate){candidate=key;stable=Date.now();}else if(Date.now()-stable>1500&&occupied.join()!==key){occupied=ids;render();}detectError='';}catch{detectError='Invalid detector result';}});},2000);
 const displaysChanged=()=>{if(model.settings.game){occupied=screen.getAllDisplays().map(d=>d.id);candidate='';stable=Date.now();}render();};screen.on('display-added',displaysChanged);screen.on('display-removed',displaysChanged);screen.on('display-metrics-changed',displaysChanged);if(model.settings.game)occupied=screen.getAllDisplays().map(d=>d.id);render();
}
