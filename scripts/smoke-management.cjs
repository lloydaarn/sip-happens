// Local integration test: isolated profiles, loopback TLS, real Electron IPC.
const {mkdtempSync,mkdirSync,writeFileSync,readFileSync,existsSync,rmSync}=require('node:fs');
const {tmpdir}=require('node:os');const path=require('node:path');const {spawn}=require('node:child_process');const assert=require('node:assert/strict');const {randomUUID}=require('node:crypto');
const root=mkdtempSync(path.join(tmpdir(),'sip-management-'));const children=[];let serial=0;
const wait=ms=>new Promise(r=>setTimeout(r,ms));
async function until(test,label,ms=20000){const end=Date.now()+ms;while(Date.now()<end){const value=await test();if(value)return value;await wait(150);}throw Error('Timed out: '+label);}
async function request(role,action,data){const id=++serial;const input=path.join(root,role+'-'+id+'.request.json'),output=path.join(root,role+'-'+id+'.response.json');writeFileSync(input,JSON.stringify({action,data}));await until(()=>existsSync(output),'IPC response '+role+' '+action);const r=JSON.parse(readFileSync(output,'utf8'));if(!r.ok)throw Error(r.error);return r.value;}
async function launch(role){
 const dir=path.join(root,'sip-happens-'+role);mkdirSync(dir);writeFileSync(path.join(dir,'state.json'),JSON.stringify({id:randomUUID(),port:19443,settings:{minutes:120,game:true,paused:false,start:0,end:0},state:{due:Date.now()+7200000},devices:{},events:[]}));
 const wrapper=path.join(root,role+'.cjs');
 writeFileSync(wrapper,`
 const {app,BrowserWindow}=require(${JSON.stringify(path.resolve('node_modules/electron'))});
 const fs=require('node:fs'),path=require('node:path');const root=${JSON.stringify(root)},role=${JSON.stringify(role)};
 app.setPath('appData',root);
 require(${JSON.stringify(path.resolve('dist',role+'.cjs'))});
 let busy=false;setInterval(async()=>{if(busy)return;const name=fs.readdirSync(root).find(n=>n.startsWith(role+'-')&&n.endsWith('.request.json'));if(!name)return;const w=BrowserWindow.getAllWindows().find(w=>w.webContents.getURL().includes('overlay=false'));if(!w||w.webContents.isLoadingMainFrame())return;busy=true;
 const input=path.join(root,name),output=input.replace('.request.json','.response.json');const request=JSON.parse(fs.readFileSync(input,'utf8'));fs.unlinkSync(input);
 try{let value;if(request.action==='__exit'){value=true;setTimeout(()=>app.exit(),100);}else if(request.action==='__ui')value=await w.webContents.executeJavaScript('JSON.stringify({countdowns:[...document.querySelectorAll("output.countdown")].map(e=>e.textContent),preferred:!!document.querySelector("select[name=spare]"),passwords:document.querySelectorAll("input[type=password]").length,snooze:[...document.querySelectorAll("button")].some(e=>e.textContent==="Snooze 5 minutes")})');else if(request.action==='__windows')value=BrowserWindow.getAllWindows().map(w=>({visible:w.isVisible(),fullscreen:w.isFullScreen()}));else value=await w.webContents.executeJavaScript('window.sip.call('+JSON.stringify(request.action)+','+JSON.stringify(request.data??null)+')');fs.writeFileSync(output,JSON.stringify({ok:true,value}));}catch{fs.writeFileSync(output,JSON.stringify({ok:false,error:'Test IPC failed for '+request.action}));}finally{busy=false;}},100);
 `);
 // Resolve the Electron package to its executable in the controller, then use
 // the runtime's built-in electron module from the wrapper.
 writeFileSync(wrapper,readFileSync(wrapper,'utf8').replace('require('+JSON.stringify(path.resolve('node_modules/electron'))+')',"require('electron')"));
 const env={...process.env};delete env.ELECTRON_RUN_AS_NODE;
 const child=spawn(require('electron'),[wrapper],{env,windowsHide:true,stdio:['ignore','ignore','ignore']});children.push(child);return child;
}
(async()=>{
 await launch('admin');await launch('client');
 await request('client','password','initial-test-password');await request('admin','pairCode');const admin=await request('admin','state');
 await request('client','pair',{host:'127.0.0.1',port:19443,fingerprint:admin.fingerprint,code:admin.code});
 const device=await until(async()=>{const s=await request('admin','state');return s.devices.find(d=>d.connected&&d.managementControls);},'paired client status');
 assert.ok(device.remainingMs>0);assert.ok(device.displays.length>0);assert.equal(device.settings.minutes,120);
 console.log('Live status: countdown, schedule and display list received over TLS.');
 async function manage(data){await request('admin','manageClient',{device:device.id,...data});await until(async()=>{const s=await request('admin','state');const c=s.commands.at(-1);if(c?.outcome==='rejected')throw Error('Management rejected: '+c.reason);return c?.outcome==='acknowledged';},'management acknowledgment');}
 const spare=device.displays.at(-1).id;
 await manage({action:'settings',settings:{minutes:1,game:true,paused:false,start:0,end:0,spare}});
 await until(async()=>{const s=await request('admin','state');const d=s.devices[0];return d.settings.minutes===1&&d.settings.spare===spare&&d.remainingMs<61000;},'confirmed schedule');
 console.log('Preferred monitor and interval: applied and confirmed by client.');
 await until(async()=>{const ui=JSON.parse(await request('admin','__ui'));return ui.countdowns.length&&ui.preferred&&ui.passwords>=2&&ui.snooze;},'rendered admin management controls');
 const clientUI=JSON.parse(await request('client','__ui'));assert.ok(clientUI.passwords>=3);console.log('Rendered controls: live countdown, preferred-display selector, password forms and snooze button present.');
 await request('client','changePassword',{current:'initial-test-password',next:'changed-test-password'});
 await request('client','password','changed-test-password');
 await manage({action:'password_reset',newPassword:'reset-test-password'});
 await request('client','password','reset-test-password');const history=await request('admin','state');assert.ok(!JSON.stringify(history).includes('reset-test-password'));
 console.log('Password change and paired-admin reset: verified; secret absent from admin state.');
 await request('admin','forceReminder',device.id);const reminder=await until(async()=>{const s=await request('client','state');return s.reminder;},'pending reminder');
 await manage({action:'snooze',reminder,seconds:300});const snoozed=await request('client','state');assert.equal(snoozed.reminder,reminder);assert.equal(snoozed.phase,'snoozed');assert.ok(snoozed.snoozeRemainingMs>290000&&snoozed.snoozeRemainingMs<=300000);
 const windows=await request('client','__windows');assert.ok(windows.every(w=>!w.visible));
 console.log('Five-minute snooze: acknowledged, same reminder retained, overlay windows closed.');
 await request('admin','__exit');await until(async()=>!(await request('client','state')).connected,'offline suspension');const offline=await request('client','state');assert.equal(offline.reminder,reminder);assert.equal(offline.suspended,true);
 console.log('Admin offline: pending snoozed reminder remains suspended.');
 await request('client','__exit');
})().then(()=>{console.log('Integration checks passed.');}).catch(e=>{console.error(e.message);process.exitCode=1;}).finally(async()=>{
 for(const child of children)if(child.exitCode===null)child.kill();await wait(600);
 const resolved=path.resolve(root),prefix=path.resolve(tmpdir())+path.sep+'sip-management-';
 if(!resolved.startsWith(prefix))throw Error('Unexpected test profile path');
 try{rmSync(resolved,{recursive:true,force:true});}catch{console.error('Test profile cleanup deferred: '+resolved);}
});
