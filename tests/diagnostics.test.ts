import {test} from 'node:test';
import assert from 'node:assert/strict';
import {ConnectionDiagnostics,networkIssue,closeIssues} from '../packages/diagnostics';
test('network errors distinguish refusal, DNS, timeout, reset and TLS',()=>{
 for(const [code,result] of Object.entries({ECONNREFUSED:'REFUSED',ENOTFOUND:'DNS',ETIMEDOUT:'TIMEOUT',ECONNRESET:'RESET',ENETUNREACH:'UNREACHABLE',ERR_SSL_PROTOCOL_ERROR:'TLS'}))assert.equal(networkIssue({code}),result);
 assert.equal(networkIssue({message:'Opening handshake has timed out'}),'TIMEOUT');
 assert.equal(networkIssue({message:'password=secret token=secret'}),'UNKNOWN');
});
test('structured reports exclude arbitrary error payloads and bound history',()=>{
 const d=new ConnectionDiagnostics();d.begin('192.168.0.10',9443);d.set(networkIssue({code:'ECONNREFUSED',message:'private credential'}));
 assert.equal(d.current.code,'REFUSED');assert.ok(!JSON.stringify(d.snapshot()).includes('private credential'));
 d.set('CONNECTED');assert.equal(d.current.code,'CONNECTED');
 for(let i=0;i<60;i++)d.set('CLOSED');assert.equal(d.history.length,40);
 assert.equal(d.endpoint,'192.168.0.10:9443');
});
test('server rejection codes have actionable distinct messages',()=>{
 assert.equal(closeIssues[4001],'PAIR_EXPIRED');assert.equal(closeIssues[4002],'PAIR_INVALID');
 assert.equal(closeIssues[4003],'PAIR_LIMIT');assert.equal(closeIssues[4004],'AUTH_REJECTED');assert.equal(closeIssues[4005],'AUTH_TIMEOUT');
});
