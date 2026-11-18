import {test} from 'node:test';import assert from 'node:assert/strict';import {randomUUID} from 'node:crypto';
import {PasswordManager,PasswordRecord} from '../packages/passwords';
import {Reminder,defaults,targets,reminderPresentation} from '../packages/core';
import {ManagementCommand,applyManagement,commandSummary} from '../packages/management';
import {reminderTiming,countdown} from '../packages/timing';
function vault(){let record:PasswordRecord|undefined;let now=100;return {passwords:new PasswordManager(()=>record,r=>record=r,()=>now),record:()=>record,advance:()=>now+=3001};}
function command(device:string,action:string,extra:object={}){return {type:'manage',id:randomUUID(),device,expires:1000,action,...extra};}
test('password change requires current password, throttles failures, and invalidates the old password',async()=>{
 const v=vault();await v.passwords.authenticate('original-password');const original=v.record();
 await assert.rejects(v.passwords.change('wrong-password','replacement-password'),/Incorrect/);assert.equal(v.record(),original);
 await assert.rejects(v.passwords.change('original-password','replacement-password'),/wait/);
 v.advance();await v.passwords.change('original-password','replacement-password');assert.notEqual(v.record()?.salt,original?.salt);
 assert.equal(await v.passwords.authenticate('replacement-password'),'verified');await assert.rejects(v.passwords.authenticate('original-password'),/Incorrect/);
});
test('paired admin can reset a forgotten password without dismissing the reminder; secret is absent from history',async()=>{
 const v=vault();await v.passwords.authenticate('forgotten-password');const m=new Reminder({due:0});m.tick(100,12);const reminder=m.state.reminder,device=randomUUID(),seen=new Set<string>();
 const c=command(device,'password_reset',{newPassword:'replacement-password'});
 assert.equal((await applyManagement(c,device,100,seen,m,v.passwords,false)).outcome,'acknowledged');assert.equal(m.state.reminder,reminder);
 assert.equal(await v.passwords.authenticate('replacement-password'),'verified');const summary=commandSummary(ManagementCommand.parse(c));
 assert.ok(!JSON.stringify(summary).includes('replacement-password'));assert.ok(!('newPassword' in summary));
});
test('invalid, expired, replayed and wrong-device reset commands cannot change the password',async()=>{
 const v=vault();await v.passwords.authenticate('original-password');const original=v.record();const m=new Reminder({due:0}),device=randomUUID(),seen=new Set<string>();const c=command(device,'password_reset',{newPassword:'replacement-password'});
 for(const [raw,target,time] of [[c,randomUUID(),100],[c,device,1001],[{...c,newPassword:'short'},device,100]] as const)assert.equal((await applyManagement(raw,target,time,seen,m,v.passwords,false)).outcome,'rejected');
 assert.equal(v.record(),original);await applyManagement(c,device,100,seen,m,v.passwords,false);const changed=v.record();assert.equal((await applyManagement(c,device,100,seen,m,v.passwords,false)).outcome,'rejected');assert.equal(v.record(),changed);
});
test('password operations serialize so remote reset cannot race a local password change',async()=>{
 const v=vault();await v.passwords.authenticate('original-password');const changing=v.passwords.change('original-password','replacement-password');await assert.rejects(v.passwords.reset('another-password'),/in progress/);await changing;assert.equal(await v.passwords.authenticate('replacement-password'),'verified');
});
test('snooze lasts at most five minutes, survives restart, and can only be used once per reminder',()=>{
 const m=new Reminder({due:0});m.tick(100,12);const id=m.state.reminder!;assert.equal(m.snooze(id,100,301),false);assert.equal(m.snooze(id,100,0),false);assert.equal(m.snooze(id,100,300),true);
 assert.deepEqual(reminderPresentation(id,true,[1,2],[],true,undefined,m.state.snoozeUntil,300099).ids,[]);
 const restarted=new Reminder(JSON.parse(JSON.stringify(m.state)));assert.equal(restarted.snooze(id,200,300),false);
 assert.deepEqual(reminderPresentation(id,true,[1,2],[1],true,undefined,restarted.state.snoozeUntil,300100).ids,[2]);
 assert.equal(restarted.state.reminder,id);assert.equal(restarted.unlock(id,300200),true);assert.equal(restarted.state.snoozeUntil,undefined);
});
test('offline snoozed reminders remain hidden and force can end snooze without permitting repeated extensions',()=>{
 const m=new Reminder({due:0});m.tick(100,12);const id=m.state.reminder!,device=randomUUID();m.snooze(id,100);
 assert.deepEqual(reminderPresentation(id,false,[1],[],true,undefined,m.state.snoozeUntil,400000).ids,[]);
 m.forceCommand({type:'force_reminder',id:randomUUID(),device,expires:1000},device,200,new Set());assert.equal(m.state.reminder,id);assert.equal(m.state.snoozeUntil,undefined);assert.equal(m.snooze(id,200),false);
});
test('snooze commands reject stale reminder and excessive duration and report confirmed application',async()=>{
 const m=new Reminder({due:0});m.tick(100,12);const device=randomUUID(),v=vault(),seen=new Set<string>();
 for(const extra of [{reminder:randomUUID(),seconds:300},{reminder:m.state.reminder,seconds:301}])assert.equal((await applyManagement(command(device,'snooze',extra),device,100,seen,m,v.passwords,false)).outcome,'rejected');
 assert.equal((await applyManagement(command(device,'snooze',{reminder:m.state.reminder,seconds:300}),device,100,seen,m,v.passwords,false)).outcome,'acknowledged');assert.equal(m.state.snoozeUntil,300100);
});
test('schedule updates persist preferred display and reschedule changed interval; busy or removed display falls back',async()=>{
 const m=new Reminder({due:999999}),device=randomUUID(),v=vault();const settings={...defaults,minutes:15,spare:3};
 assert.equal((await applyManagement(command(device,'settings',{settings}),device,100,new Set(),m,v.passwords,false)).outcome,'acknowledged');assert.equal(m.state.due,900100);
 assert.equal(m.settings.spare,3);assert.deepEqual(targets([1,2,3],[1],true,m.settings.spare),[3]);assert.deepEqual(targets([1,2,3],[1,3],true,m.settings.spare),[2]);assert.deepEqual(targets([1,2],[1],true,m.settings.spare),[2]);assert.deepEqual(targets([1],[1],true,m.settings.spare),[]);
 const restarted=new Reminder(m.state,JSON.parse(JSON.stringify(m.settings)));assert.equal(restarted.settings.spare,3);
});
test('countdown reflects schedule, pause, hours, offline suspension, pending/deferred and snooze',()=>{
 const m=new Reminder({due:60100});assert.equal(countdown(reminderTiming(m,true,false,100,12).remainingMs),'01:00');assert.equal(reminderTiming(m,false,false,100,12).phase,'offline');m.settings.paused=true;assert.equal(reminderTiming(m,true,false,100,12).phase,'paused');m.settings.paused=false;m.settings.start=22;m.settings.end=6;assert.equal(reminderTiming(m,true,false,100,12).phase,'outside-hours');
 m.settings.start=0;m.settings.end=0;m.tick(70000,12);assert.equal(reminderTiming(m,true,true,70000,12).phase,'deferred');assert.equal(reminderTiming(m,true,false,70000,12).phase,'pending');m.snooze(m.state.reminder!,70000);assert.equal(countdown(reminderTiming(m,true,false,70000,12).snoozeRemainingMs),'05:00');assert.equal(reminderTiming(m,true,false,70000,12).phase,'snoozed');assert.equal(countdown(-5),'00:00');
});
