export const issues = {
 HEARTBEAT_TIMEOUT:['Admin stopped responding','All reminder overlays pause until the admin reconnects. Check the admin PC and LAN; the client will reconnect automatically.'],
 IDLE:['Not connected','Enter the admin address, fingerprint and a fresh pairing code.'],
 CONNECTING:['Connecting to admin','Waiting for the network and TLS handshake.'],
 AUTHENTICATING:['Admin reached; verifying pairing','Waiting for the admin to accept this device.'],
 CONNECTED:['Connected','Pairing and authentication succeeded.'],
 REFUSED:['Connection refused','Check the admin is running and its service says Listening. Verify the IP and port.'],
 TIMEOUT:['Connection timed out','Check both PCs are on the same LAN, the IP/port, and the admin Windows Firewall private-network rule. A timeout alone does not prove a firewall block.'],
 DNS:['Admin hostname could not be resolved','Use the LAN IPv4 address displayed on the admin.'],
 UNREACHABLE:['Admin network is unreachable','Check Wi-Fi, VPN routing, and the admin LAN address.'],
 RESET:['Connection was reset','The admin or network closed the connection. Retry and inspect admin diagnostics.'],
 TLS:['Secure connection failed','Verify the address and port point to Sip Happens Admin.'],
 FINGERPRINT:['Certificate fingerprint does not match','Copy the fingerprint from the trusted admin screen again. A reinstalled/reset admin may have a new certificate.'],
 PAIR_EXPIRED:['Pairing code expired or not generated','Generate a new code on the admin and enter it within two minutes.'],
 PAIR_INVALID:['Pairing code was rejected','Check the six-digit code and generate a fresh one if necessary.'],
 PAIR_LIMIT:['Pairing attempt limit reached','Generate a new pairing code on the admin to reset the attempt limit.'],
 AUTH_REJECTED:['Saved device authorization was rejected','The admin may have revoked or reset this device. Pair again with a fresh code.'],
 AUTH_TIMEOUT:['Admin did not finish authentication','Retry pairing and copy diagnostics from both PCs if this continues.'],
 PROTOCOL:['Unexpected connection data','Update both apps to the latest version and retry.'],
 CLOSED:['Admin closed the connection','If pairing was in progress, use a fresh code. Older admins may not provide a specific rejection reason.'],
 OFFLINE:['Disconnected for demo','Use Reconnect admin in the demo controls.'],
 LISTENING:['Admin service listening','Clients can connect using the LAN address and port shown above.'],
 PORT_IN_USE:['Admin port is already in use','Close the other admin instance or configure a different port.'],
 BIND_FAILED:['Admin service could not start','Check port configuration and Windows permissions.'],
 CREDENTIALS:['Saved credentials could not be read','Pair again. Credentials may belong to a different Windows account or test build.'],
 UNKNOWN:['Connection failed','Retry and share diagnostics from both PCs.'],
} as const;
export type IssueCode=keyof typeof issues;
export const closeIssues:Record<number,IssueCode>={4001:'PAIR_EXPIRED',4002:'PAIR_INVALID',4003:'PAIR_LIMIT',4004:'AUTH_REJECTED',4005:'AUTH_TIMEOUT',4006:'PROTOCOL'};
export function networkIssue(error:unknown):IssueCode{
 const e=error as {code?:string;message?:string};
 switch(e?.code){case 'ECONNREFUSED':return 'REFUSED';case 'ETIMEDOUT':return 'TIMEOUT';case 'ENOTFOUND':case 'EAI_AGAIN':return 'DNS';case 'EHOSTUNREACH':case 'ENETUNREACH':return 'UNREACHABLE';case 'ECONNRESET':return 'RESET';}
 if(e?.code?.includes('SSL')||e?.code?.includes('TLS'))return 'TLS';
 if(e?.message?.toLowerCase().includes('timed out'))return 'TIMEOUT';
 return 'UNKNOWN';
}
export class ConnectionDiagnostics{
 endpoint='';attempt=0;retryAt:number|null=null;
 current:{time:string;code:IssueCode;summary:string;hint:string}={time:new Date().toISOString(),code:'IDLE',summary:issues.IDLE[0],hint:issues.IDLE[1]};
 history:typeof this.current[]=[];
 set(code:IssueCode){const [summary,hint]=issues[code];this.current={time:new Date().toISOString(),code,summary,hint};this.history=[this.current,...this.history].slice(0,40);}
 begin(host:string,port:number){this.endpoint=`${host}:${port}`;this.attempt++;this.retryAt=null;this.set('CONNECTING');}
 snapshot(){return {endpoint:this.endpoint,attempt:this.attempt,retryAt:this.retryAt,current:this.current,history:this.history};}
}
