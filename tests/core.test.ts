import {test} from 'node:test';import assert from 'node:assert/strict';import {Reminder,defaults,targets,hashPassword,verifyPassword,Settings} from '../packages/core';import {randomUUID} from 'node:crypto';
test('overdue reminders do not stack; unlock schedules once',()=>{const m=new Reminder({due:0});m.tick(1,12);const id=m.state.reminder!;m.tick(100,12);assert.equal(m.state.reminder,id);assert.equal(m.unlock(id,100),true);assert.equal(m.unlock(id,200),false);assert.equal(m.state.due,7200100);});
test('pause preserves outstanding reminders and hours cross midnight',()=>{const m=new Reminder({due:0},{...defaults,start:22,end:6});m.tick(1,12);assert.equal(m.state.reminder,undefined);m.tick(2,23);m.settings.paused=true;m.tick(3,12);assert.ok(m.state.reminder);});
test('commands reject wrong device, stale reminder, expiry and replay',()=>{const m=new Reminder({due:0});m.tick(1,12);const device=randomUUID(),seen=new Set<string>();const c={type:'unlock',id:randomUUID(),device,reminder:m.state.reminder,expires:100};assert.equal(m.command({...c,device:randomUUID()},device,2,seen),'rejected');assert.equal(m.command({...c,expires:0},device,2,seen),'rejected');assert.equal(m.command({...c,reminder:randomUUID()},device,2,seen),'rejected');c.id=randomUUID();assert.equal(m.command(c,device,2,seen),'acknowledged');assert.equal(m.command(c,device,2,seen),'rejected');});
test('spare selection never covers occupied display',()=>{assert.deepEqual(targets([1,2],[1],true),[2]);assert.deepEqual(targets([1],[1],true),[]);assert.deepEqual(targets([1,2],[1],false),[1,2]);});
test('salted password verification and limits',async()=>{const h=await hashPassword('correct horse battery');assert.equal(await verifyPassword('incorrect',h),false);assert.equal(await verifyPassword('correct horse battery',h),true);assert.notEqual(h.salt,(await hashPassword('correct horse battery')).salt);await assert.rejects(hashPassword('short'));});
test('invalid policy rejected',()=>{assert.equal(Settings.safeParse({...defaults,minutes:0}).success,false);});

test('scheduled reminders wait while admin is unavailable and produce one overdue reminder on reconnect',()=>{
 const m=new Reminder({due:100});m.tick(200,12,false);assert.equal(m.state.reminder,undefined);assert.equal(m.state.due,100);
 m.tick(10000,12,false);assert.equal(m.state.reminder,undefined);
 m.tick(10001,12,true);const id=m.state.reminder;assert.ok(id);m.tick(20000,12,true);assert.equal(m.state.reminder,id);
});
test('offline gating preserves pending reminders and still respects pause and active hours',()=>{
 const m=new Reminder({due:0},{...defaults,start:22,end:6});m.tick(100,12,true);assert.equal(m.state.reminder,undefined);
 m.settings.paused=true;m.tick(200,23,true);assert.equal(m.state.reminder,undefined);
 m.settings.paused=false;m.tick(300,23,true);const id=m.state.reminder;m.tick(400,23,false);assert.equal(m.state.reminder,id);
 assert.equal(m.unlock(id!,500),true);m.tick(999999999,23,false);assert.equal(m.state.reminder,undefined);
});
