import {WebSocket} from 'ws';
// A connecting socket emits an asynchronous error when closed. Keep an error
// sink after detaching old connection callbacks, including its retry handler.
export function retireSocket(socket:WebSocket|undefined){
 if(!socket)return;
 socket.removeAllListeners();
 socket.on('error',()=>{});
 socket.close();
}
