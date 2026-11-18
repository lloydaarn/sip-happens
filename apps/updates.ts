export interface UpdateService {
 autoDownload:boolean; autoInstallOnAppQuit:boolean; allowPrerelease:boolean; allowDowngrade:boolean;
 on(event:string,listener:(info:any)=>void):unknown;
 checkForUpdates():Promise<unknown>;
 quitAndInstall(silent:boolean,runAfter:boolean):void;
}
export function setupUpdates(autoUpdater:UpdateService,version:string,enabled:boolean,canInstall:()=>boolean,beforeInstall:()=>void){
 const state={status:enabled?'idle':'disabled',message:enabled?'Checks automatically every hour':'Updates are available in the installed app',version,availableVersion:'',progress:0};
 let checking=false,installWhenReady=false;
 const install=(force=false)=>{if(!enabled||state.status!=='ready')throw Error('No downloaded update');if(!force&&!canInstall())throw Error('Dismiss the pending reminder before restarting');beforeInstall();autoUpdater.quitAndInstall(true,true);};
 autoUpdater.autoDownload=true;
 autoUpdater.autoInstallOnAppQuit=true;
 autoUpdater.allowPrerelease=false;
 autoUpdater.allowDowngrade=false;
 autoUpdater.on('checking-for-update',()=>{state.status='checking';state.message='Checking for updates';});
 autoUpdater.on('update-available',info=>{state.status='downloading';state.availableVersion=info.version;state.message='Downloading update';});
 autoUpdater.on('download-progress',info=>{state.progress=Math.round(info.percent);});
 autoUpdater.on('update-not-available',()=>{installWhenReady=false;state.status='current';state.message='You are up to date';});
 autoUpdater.on('update-downloaded',info=>{state.status='ready';state.availableVersion=info.version;state.message='Update ready. Installs silently when you exit from the tray, or restart below.';if(installWhenReady)install(true);});
 autoUpdater.on('error',()=>{state.status='error';state.message='Update check or download failed. Check your connection and retry.';});
 const check=async()=>{if(!enabled||checking||['downloading','ready'].includes(state.status))return;checking=true;try{await autoUpdater.checkForUpdates();}catch{state.status='error';state.message='Unable to reach the update service. Retry later.';}finally{checking=false;}};
 if(enabled){setTimeout(()=>void check(),10000).unref();setInterval(()=>void check(),3600000).unref();}
 return {state,check,install:()=>install(),force:async()=>{if(!enabled)throw Error('Install the latest app manually to enable updates');installWhenReady=true;if(state.status==='ready')install(true);else await check();}};
}
