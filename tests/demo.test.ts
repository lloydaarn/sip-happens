import {test} from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {DemoSession} from '../packages/demo';
import {Reminder,defaults,targets} from '../packages/core';
test('demo triggers once even when policy paused or outside active hours',()=>{
 const m=new Reminder({due:999999},{...defaults,paused:true,start:22,end:23});
 const d=new DemoSession(m);d.apply('reminder',100);const id=m.state.reminder;
 assert.ok(id);d.apply('reminder',200);assert.equal(m.state.reminder,id);assert.equal(m.settings.paused,true);
 assert.equal(m.unlock(id!,300),true);assert.equal(m.state.due,7200300);
});
test('demo placement uses physical displays and defers without a spare',()=>{
 const m=new Reminder({due:0});const d=new DemoSession(m);
 d.apply('fullscreen',1);assert.deepEqual(targets([1,2],d.occupied([1,2]),m.settings.game),[2]);
 assert.deepEqual(targets([1],d.occupied([1]),m.settings.game),[]);
 d.apply('no-spare',2);assert.deepEqual(targets([1,2],d.occupied([1,2]),m.settings.game),[]);
 d.apply('normal',3);assert.deepEqual(targets([1,2],d.occupied([1,2]),m.settings.game),[1,2]);
});
test('resume sets overdue deadline and 15-second grace; reset clears overrides',()=>{
 const m=new Reminder({due:99999});const d=new DemoSession(m);d.apply('resume',100);
 assert.equal(m.state.due,99);assert.equal(d.graceUntil,15100);assert.equal(m.state.reminder,undefined);
 d.apply('offline',200);assert.equal(d.offline,true);d.apply('reconnect',300);assert.equal(d.offline,false);
 d.apply('reminder',400);d.apply('no-spare',500);d.apply('offline',600);d.apply('reset',700);
 assert.deepEqual(m.state,{due:7200700});assert.equal(d.offline,false);assert.equal(d.placement,'normal');assert.equal(d.graceUntil,0);
});
test('demo reminders accept real protocol unlock; invalid demo events fail',()=>{
 const m=new Reminder({due:0});const d=new DemoSession(m);d.apply('reminder',100);const device=randomUUID();
 assert.equal(m.command({type:'unlock',id:randomUUID(),device,reminder:m.state.reminder,expires:1000},device,200,new Set()),'acknowledged');
 assert.throws(()=>d.apply('unknown',300));
});
