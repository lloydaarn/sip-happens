import {test} from 'node:test';
import assert from 'node:assert/strict';
import {Reminder,reminderPresentation} from '../packages/core';
test('pending reminder closes all overlays while offline and returns with the same ID',()=>{
 const m=new Reminder({due:0});m.tick(100,12,true);const id=m.state.reminder;
 assert.deepEqual(reminderPresentation(id,true,[1,2],[],true),{ids:[1,2],suspended:false,deferred:false});
 m.tick(200,12,false);assert.equal(m.state.reminder,id);
 assert.deepEqual(reminderPresentation(id,false,[1,2],[],true),{ids:[],suspended:true,deferred:false});
 assert.deepEqual(reminderPresentation(id,true,[1,2],[1],true),{ids:[2],suspended:false,deferred:false});
 assert.equal(m.state.reminder,id);
});
test('offline restart restores pending state without creating a blocking window',()=>{
 const saved={due:0,reminder:'saved-pending-reminder',forced:true};const m=new Reminder(JSON.parse(JSON.stringify(saved)));
 assert.deepEqual(reminderPresentation(m.state.reminder,false,[1,2],[],true).ids,[]);
 assert.deepEqual(m.state,saved);
 assert.deepEqual(reminderPresentation(m.state.reminder,true,[1],[1],true),{ids:[],suspended:false,deferred:true});
});
test('no reminder remains nonblocking online and offline',()=>{
 for(const online of [false,true])assert.deepEqual(reminderPresentation(undefined,online,[1],[],true),{ids:[],suspended:false,deferred:false});
});
