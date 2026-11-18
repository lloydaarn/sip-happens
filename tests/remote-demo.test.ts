import {test} from 'node:test';import assert from 'node:assert/strict';import {randomUUID} from 'node:crypto';
import {RemoteDemo} from '../packages/remote-demo';import {Reminder,defaults} from '../packages/core';
function command(device:string,event:string,now=100){return {type:'demo',id:randomUUID(),device,event,expires:now+1000};}
test('admin demo starts without password setup, preserves original schedule and stops cleanly',()=>{
 const m=new Reminder({due:9000},{...defaults,paused:true,game:true});const d=new RemoteDemo(m);const id=randomUUID();
 assert.equal(d.apply(command(id,'reminder'),id,100,new Set()),'acknowledged');assert.ok(m.state.reminder);assert.ok(d.session);
 assert.deepEqual(d.original?.state,{due:9000});assert.equal(d.original?.settings.paused,true);
 m.unlock(m.state.reminder!,200);assert.deepEqual(d.original?.state,{due:9000});
 d.stop();assert.deepEqual(m.state,{due:9000});assert.equal(m.settings.paused,true);assert.equal(m.settings.game,true);
});
test('real pending reminders cannot be discarded by starting or stopping demo',()=>{
 const m=new Reminder({due:0});m.tick(10,12);const original=m.state.reminder;
 const d=new RemoteDemo(m),id=randomUUID();assert.equal(d.apply(command(id,'reminder'),id,100,new Set()),'rejected');
 d.stop();assert.equal(m.state.reminder,original);
});
test('demo commands reject stale, replayed and wrong-device messages',()=>{
 const m=new Reminder({due:9000});const d=new RemoteDemo(m),id=randomUUID(),seen=new Set<string>();const c=command(id,'no-spare');
 assert.equal(d.apply(c,randomUUID(),100,seen),'rejected');assert.equal(d.apply(c,id,5000,seen),'rejected');
 assert.equal(d.apply(c,id,100,seen),'acknowledged');assert.equal(d.apply(c,id,100,seen),'rejected');
 assert.deepEqual(d.session?.occupied([1,2]),[1,2]);
});
test('demo timeout restores production policy and supports a second session',()=>{
 const m=new Reminder({due:9000});const d=new RemoteDemo(m),id=randomUUID();
 d.apply(command(id,'resume'),id,100,new Set());assert.equal(d.session?.graceUntil,15100);
 assert.equal(d.tick(300099),false);assert.equal(d.tick(300100),true);assert.deepEqual(m.state,{due:9000});
 assert.equal(d.apply(command(id,'reminder',400000),id,400000,new Set()),'acknowledged');assert.ok(m.state.reminder);
});

test('trigger reminder restores automatic Game Mode after display simulation',()=>{
 const m=new Reminder({due:9000},{...defaults,game:true});const d=new RemoteDemo(m),id=randomUUID();
 d.apply(command(id,'no-spare'),id,100,new Set());assert.equal(d.session?.placement,'no-spare');
 d.apply(command(id,'reminder'),id,200,new Set());assert.equal(d.session?.placement,'normal');assert.equal(m.settings.game,true);assert.equal(d.simulated,false);assert.ok(m.state.reminder);
 d.stop();assert.equal(m.settings.game,true);
});
