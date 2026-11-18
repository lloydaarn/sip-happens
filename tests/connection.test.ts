import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createServer} from 'node:net';
import {WebSocket} from 'ws';
import {retireSocket} from '../packages/connection';
test('retiring a connecting WebSocket absorbs cancellation errors and detaches retries',async()=>{
 const server=createServer();await new Promise<void>(resolve=>server.listen(0,'127.0.0.1',resolve));
 const address=server.address() as {port:number};
 const socket=new WebSocket(`ws://127.0.0.1:${address.port}`);
 let retries=0;socket.on('close',()=>retries++);
 retireSocket(socket);
 await new Promise<void>(resolve=>socket.once('close',resolve));
 assert.equal(socket.readyState,WebSocket.CLOSED);assert.equal(retries,0);
 await new Promise<void>(resolve=>server.close(()=>resolve()));
});
