import {randomUUID,scrypt as derive,randomBytes,timingSafeEqual} from 'node:crypto';
import {promisify} from 'node:util';
import {z} from 'zod';
export const Settings=z.object({minutes:z.number().int().min(1).max(1440),game:z.boolean().transform(():boolean=>true),paused:z.boolean(),start:z.number().int().min(0).max(23),end:z.number().int().min(0).max(23),spare:z.number().int().optional()});
export type Settings=z.infer<typeof Settings>;
export const defaults:Settings={minutes:120,game:true,paused:false,start:0,end:0};
export const Command=z.object({type:z.literal('unlock'),id:z.string().uuid(),device:z.string().uuid(),reminder:z.string().uuid(),expires:z.number()});
export const ForceCommand=z.object({type:z.literal('force_reminder'),id:z.string().uuid(),device:z.string().uuid(),expires:z.number()});
export class Reminder {
 constructor(public state:{due:number;reminder?:string;forced?:boolean;snoozeUntil?:number;snoozedReminder?:string},public settings:Settings=defaults){this.settings=Settings.parse(settings);}
 tick(now:number,hour:number,adminAvailable=true){const s=this.settings;const active=s.start===s.end||(s.start<s.end?hour>=s.start&&hour<s.end:hour>=s.start||hour<s.end);if(adminAvailable&&!this.state.reminder&&!s.paused&&active&&now>=this.state.due)this.state.reminder=randomUUID();}
 forceCommand(raw:unknown,device:string,now:number,seen:Set<string>,beforeApply:()=>void=()=>{}){const parsed=ForceCommand.safeParse(raw);if(!parsed.success)return 'rejected';const c=parsed.data;if(c.device!==device||c.expires<now||c.expires>now+60000||seen.has(c.id))return 'rejected';seen.add(c.id);beforeApply();this.state={...this.state,reminder:this.state.reminder||randomUUID(),forced:true,snoozeUntil:undefined};return 'acknowledged';}
 snooze(id:string,now:number,seconds=300){if(!Number.isInteger(seconds)||seconds<1||seconds>300||!id||id!==this.state.reminder||this.state.snoozedReminder===id)return false;this.state={...this.state,snoozeUntil:now+seconds*1000,snoozedReminder:id};return true;}
 unlock(id:string,now:number){if(!id||id!==this.state.reminder)return false;this.state={due:now+this.settings.minutes*60000};return true;}
 command(raw:unknown,device:string,now:number,seen:Set<string>){const c=Command.safeParse(raw);if(!c.success)return 'rejected';const x=c.data;if(seen.has(x.id)||x.device!==device||x.expires<now||x.expires>now+60000)return 'rejected';seen.add(x.id);return this.unlock(x.reminder,now)?'acknowledged':'rejected';}
}
const scrypt=promisify(derive);
export async function hashPassword(password:string){if(password.length<10||password.length>256)throw Error('Use 10–256 characters');const salt=randomBytes(16).toString('hex');return {salt,hash:(await scrypt(password,salt,64) as Buffer).toString('hex')};}
export async function verifyPassword(password:string,record:{salt:string;hash:string}){if(password.length>256)return false;return timingSafeEqual(await scrypt(password,record.salt,64) as Buffer,Buffer.from(record.hash,'hex'));}
export function targets(displays:number[],occupied:number[],game:boolean,spare?:number){if(!game||!occupied.length)return displays;const available=displays.filter(x=>!occupied.includes(x));return available.includes(spare!)?[spare!]:available.slice(0,1);}

export function reminderPresentation(reminder:string|undefined,adminAvailable:boolean,displays:number[],occupied:number[],game:boolean,spare?:number,snoozeUntil=0,now=Date.now()){
 const snoozed=!!reminder&&now<snoozeUntil;
 const suspended=!!reminder&&!adminAvailable;
 const ids=reminder&&adminAvailable&&!snoozed?targets(displays,occupied,game,spare):[];
 return {ids,suspended,deferred:!!reminder&&adminAvailable&&!snoozed&&!ids.length};
}
