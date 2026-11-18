import {randomBytes} from 'node:crypto';
import {performance} from 'node:perf_hooks';
import {WebSocket} from 'ws';
export const HEARTBEAT_INTERVAL_MS=5000;
export const HEARTBEAT_TIMEOUT_MS=5000;
// WebSocket control pongs are automatic, including in older Sip Happens apps.
export function watchHeartbeat(socket:WebSocket,onUnavailable:()=>void,options:{intervalMs?:number;timeoutMs?:number;now?:()=>number}={}){
 const interval=options.intervalMs??HEARTBEAT_INTERVAL_MS,timeout=options.timeoutMs??HEARTBEAT_TIMEOUT_MS,now=options.now??(()=>performance.now());
 let lastReply=now(),pending:Buffer|undefined,sentAt=0,stopped=false;
 const pong=(data:Buffer)=>{if(pending&&data.equals(pending)){pending=undefined;lastReply=now();}};
 const stop=()=>{if(stopped)return;stopped=true;clearInterval(timer);socket.off('pong',pong);socket.off('close',stop);};
 const fail=()=>{stop();onUnavailable();socket.terminate();};
 const timer=setInterval(()=>{
  if(stopped)return;
  if(socket.readyState!==WebSocket.OPEN){fail();return;}
  if(pending){if(now()-sentAt>=timeout)fail();return;}
  pending=randomBytes(8);sentAt=now();socket.ping(pending,undefined,(error?:Error)=>{if(error&&!stopped)fail();});
 },Math.min(interval,timeout));timer.unref();
 socket.on('pong',pong);socket.once('close',stop);
 return {stop,isHealthy:()=>!stopped&&socket.readyState===WebSocket.OPEN&&now()-lastReply<interval+timeout};
}
