import {test} from 'node:test';
import assert from 'node:assert/strict';
import {once} from 'node:events';
import {WebSocket,WebSocketServer} from 'ws';
import {watchHeartbeat} from '../packages/heartbeat';
async function pair(autoPong=true){
 const server=new WebSocketServer({port:0,host:'127.0.0.1',autoPong});await once(server,'listening');
 const address=server.address() as {port:number};const accepted=once(server,'connection');
 const client=new WebSocket('ws://127.0.0.1:'+address.port);client.on('error',()=>{});await once(client,'open');const [peer]=await accepted;
 return {server,client,peer:peer as WebSocket,close:async()=>{client.terminate();for(const ws of server.clients)ws.terminate();await new Promise<void>(r=>server.close(()=>r()));}};
}
test('control pongs keep an authenticated connection healthy and stop detaches monitoring',async()=>{
 const connection=await pair();let failures=0;const before=connection.client.listenerCount('pong');
 const health=watchHeartbeat(connection.client,()=>failures++,{intervalMs:20,timeoutMs:100});
 try{await once(connection.client,'pong');assert.equal(health.isHealthy(),true);assert.equal(failures,0);health.stop();assert.equal(health.isHealthy(),false);assert.equal(connection.client.listenerCount('pong'),before);}finally{health.stop();await connection.close();}
});
test('silent remote failure terminates socket and reports unavailable',async()=>{
 const connection=await pair(false);let failed!:()=>void;const failure=new Promise<void>(r=>failed=r);
 const health=watchHeartbeat(connection.client,failed,{intervalMs:20,timeoutMs:40});
 let deadline!:ReturnType<typeof setTimeout>;const expired=new Promise<never>((_,reject)=>{deadline=setTimeout(()=>reject(Error('Heartbeat did not detect failure')),1000);});
 try{await Promise.race([failure,expired]);assert.equal(health.isHealthy(),false);assert.ok(connection.client.readyState===WebSocket.CLOSING||connection.client.readyState===WebSocket.CLOSED);}finally{clearTimeout(deadline);health.stop();await connection.close();}
});
test('stale heartbeat age blocks reminders immediately after timer suspension',async()=>{
 const connection=await pair();let now=100;
 const health=watchHeartbeat(connection.client,()=>{},{now:()=>now,intervalMs:5000,timeoutMs:5000});
 try{assert.equal(health.isHealthy(),true);now=10100;assert.equal(health.isHealthy(),false);}finally{health.stop();await connection.close();}
});
