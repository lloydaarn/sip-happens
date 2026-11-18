import {contextBridge,ipcRenderer} from 'electron';
contextBridge.exposeInMainWorld('sip',{call:(action:string,data?:unknown)=>ipcRenderer.invoke('sip',action,data)});
