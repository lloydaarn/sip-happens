import {test} from 'node:test';
import assert from 'node:assert/strict';
import {EventEmitter} from 'node:events';
import {setupUpdates} from '../apps/updates';
class FakeUpdater extends EventEmitter {
 autoDownload=false;autoInstallOnAppQuit=false;allowPrerelease=true;allowDowngrade=true;checks=0;installs=0;
 async checkForUpdates(){this.checks++;}
 quitAndInstall(){this.installs++;}
}
test('downloads automatically but waits for safe install; ready state survives recheck',async()=>{
 const f=new FakeUpdater();let pending=true,quitting=false;
 const u=setupUpdates(f,'0.1.1',true,()=>!pending,()=>{quitting=true;});
 assert.equal(f.autoDownload,true);assert.equal(f.autoInstallOnAppQuit,true);assert.equal(f.allowDowngrade,false);
 await u.check();assert.equal(f.checks,1);
 f.emit('update-downloaded',{version:'0.1.2'});await u.check();assert.equal(f.checks,1);
 assert.throws(()=>u.install(),/Dismiss/);assert.equal(f.installs,0);
 pending=false;u.install();assert.equal(f.installs,1);assert.equal(quitting,true);
});
test('development/demo checks disabled and failures recover',async()=>{
 const f=new FakeUpdater();const disabled=setupUpdates(f,'0.1.1',false,()=>true,()=>{});
 await disabled.check();assert.equal(f.checks,0);assert.throws(()=>disabled.install());
 const g=new FakeUpdater();g.checkForUpdates=async()=>{throw Error('offline');};
 const u=setupUpdates(g,'0.1.1',true,()=>true,()=>{});await u.check();assert.equal(u.state.status,'error');
 g.checkForUpdates=async()=>{g.emit('update-not-available');};await u.check();assert.equal(u.state.status,'current');
});
test('explicit force update installs on download even during a pending reminder',async()=>{
 const f=new FakeUpdater();let saved=false;const u=setupUpdates(f,'0.1.1',true,()=>false,()=>{saved=true;});
 await u.force();assert.equal(f.checks,1);assert.equal(f.installs,0);
 f.emit('update-downloaded',{version:'0.1.2'});assert.equal(f.installs,1);assert.equal(saved,true);
});
