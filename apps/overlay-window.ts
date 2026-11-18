import type {BrowserWindow,Rectangle} from 'electron';
// Enter native fullscreen after showing, then reassert shell z-order. Normal
// and spare-monitor windows share this path; spare windows never request focus.
export function presentOverlay(window:BrowserWindow,bounds:Rectangle,activate:boolean){
 if(window.isDestroyed())return;
 const current=window.getBounds();
 if(current.x!==bounds.x||current.y!==bounds.y||current.width!==bounds.width||current.height!==bounds.height){
  if(window.isFullScreen())window.setFullScreen(false);
  window.setBounds(bounds);
 }
 const reinforce=()=>{if(window.isDestroyed())return;window.setAlwaysOnTop(false);window.setAlwaysOnTop(true,'screen-saver');window.moveTop();};
 if(!window.isFullScreen())window.once('enter-full-screen',reinforce);
 if(activate)window.show();else window.showInactive();
 window.setFullScreen(true);
 window.setAlwaysOnTop(true,'screen-saver');
 window.moveTop();
 setTimeout(reinforce,150).unref();
}
