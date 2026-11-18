const {app,BrowserWindow,screen}=require('electron');const {buildSync}=require('esbuild');const {execFileSync}=require('node:child_process');const path=require('node:path');const assert=require('node:assert/strict');
app.on('window-all-closed',()=>{});
const wait=ms=>new Promise(r=>setTimeout(r,ms));
app.whenReady().then(async()=>{
 buildSync({entryPoints:['apps/overlay-window.ts'],outfile:'dist/overlay-window-check.cjs',bundle:true,platform:'node'});
 const {presentOverlay}=require(path.resolve('dist/overlay-window-check.cjs'));require('node:fs').unlinkSync(path.resolve('dist/overlay-window-check.cjs'));
 const displays=screen.getAllDisplays();const windows=[];
 function make(d){const w=new BrowserWindow({...d.bounds,show:false,frame:false,roundedCorners:false,skipTaskbar:true,movable:false,resizable:true});windows.push(w);return w;}
 function covered(w,d){const dip={x:d.bounds.x+Math.floor(d.bounds.width/2),y:d.bounds.y+d.bounds.height-5};const p=screen.dipToScreenPoint(dip);
 const script=`Add-Type @'\nusing System;using System.Runtime.InteropServices;public class Hit { [StructLayout(LayoutKind.Sequential)]public struct Point{public int X,Y;} [DllImport("user32.dll")]static extern IntPtr WindowFromPoint(Point p); [DllImport("user32.dll")]static extern uint GetWindowThreadProcessId(IntPtr h,out uint id);public static uint Pid(int x,int y){uint id;GetWindowThreadProcessId(WindowFromPoint(new Point{X=x,Y=y}),out id);return id;} }\n'@\n[Hit]::Pid(${p.x},${p.y})`;
 const hit=Number(execFileSync('powershell.exe',['-NoProfile','-Command',script],{encoding:'utf8',windowsHide:true}).trim());assert.equal(hit,process.pid,'Overlay must own the bottom-of-display pixel, above the taskbar');assert.equal(w.isFullScreen(),true);assert.deepEqual(w.getBounds(),d.bounds);return hit;}
 const normal=make(displays[0]);await normal.loadURL('data:text/html,<body style="background:navy;color:white">Fullscreen placement check</body>');presentOverlay(normal,displays[0].bounds,true);await wait(500);covered(normal,displays[0]);console.log('Normal trigger: native fullscreen and bottom pixel coverage passed.');normal.destroy();
 if(displays.length>1){const game=make(displays[0]);await game.loadURL('data:text/html,<body>Focus check</body>');game.show();game.setFullScreen(true);game.focus();await wait(200);const spare=make(displays[1]);await spare.loadURL('data:text/html,<body style="background:navy">Spare monitor check</body>');presentOverlay(spare,displays[1].bounds,false);await wait(500);covered(spare,displays[1]);assert.equal(game.isFocused(),true,'Spare overlay must not steal focus');console.log('Spare-monitor trigger: fullscreen, bottom pixel coverage and focus preservation passed.');}
 for(const w of windows)if(!w.isDestroyed())w.destroy();app.exit(0);
}).catch(e=>{console.error(e);app.exit(1)});
