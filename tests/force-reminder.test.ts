import {test} from 'node:test';import assert from 'node:assert/strict';import {randomUUID} from 'node:crypto';
import {Reminder,Settings,defaults,targets} from '../packages/core';
import {RemoteDemo} from '../packages/remote-demo';
function command(device:string){return {type:'force_reminder',id:randomUUID(),device,expires:1000};}
test('force reminder bypasses pause and active hours, retains one outstanding reminder',()=>{
 const m=new Reminder({due:99999},{...defaults,paused:true,start:22,end:23});const device=randomUUID(),seen=new Set<string>();
 assert.equal(m.forceCommand(command(device),device,100,seen),'acknowledged');const reminder=m.state.reminder;assert.ok(reminder);assert.equal(m.state.forced,true);
 assert.equal(m.forceCommand(command(device),device,200,seen),'acknowledged');assert.equal(m.state.reminder,reminder);assert.equal(m.settings.paused,true);
 assert.equal(m.unlock(reminder!,300),true);assert.equal(m.state.forced,undefined);assert.equal(m.state.due,7200300);
});
test('wrong device, expired, malformed and replayed force commands have no side effects',()=>{
 const m=new Reminder({due:99999});const device=randomUUID(),seen=new Set<string>(),c=command(device);let mutations=0;
 const before=()=>mutations++;
 assert.equal(m.forceCommand(c,randomUUID(),100,seen,before),'rejected');
 assert.equal(m.forceCommand(c,device,2000,seen,before),'rejected');
 assert.equal(m.forceCommand({},device,100,seen,before),'rejected');assert.equal(mutations,0);
 assert.equal(m.forceCommand(c,device,100,seen,before),'acknowledged');
 assert.equal(m.forceCommand(c,device,100,seen,before),'rejected');assert.equal(mutations,1);
});
test('force exits demo after validation and persists a real reminder using original schedule',()=>{
 const m=new Reminder({due:99999},{...defaults,minutes:15});const d=new RemoteDemo(m),device=randomUUID(),seen=new Set<string>();
 d.apply({type:'demo',id:randomUUID(),device,event:'reminder',expires:1000},device,100,seen);
 m.forceCommand(command(device),device,200,seen,()=>d.stop());assert.equal(d.session,undefined);assert.ok(m.state.reminder);assert.equal(m.state.forced,true);assert.equal(m.settings.minutes,15);
});
test('Game Mode migrates legacy off settings and force keeps occupied monitors usable',()=>{
 assert.equal(defaults.game,true);assert.equal(Settings.parse({...defaults,game:false}).game,true);
 const m=new Reminder({due:99999},{...defaults,game:false});assert.equal(m.settings.game,true);
 const device=randomUUID();m.forceCommand(command(device),device,100,new Set());
 assert.deepEqual(targets([1,2],[1],m.settings.game),[2]);assert.deepEqual(targets([1],[1],m.settings.game),[]);
});
