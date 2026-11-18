import {z} from 'zod';
import {Reminder,Settings} from './core';
import {NewPassword,PasswordManager} from './passwords';
const base={type:z.literal('manage'),id:z.string().uuid(),device:z.string().uuid(),expires:z.number().finite()};
export const ManagementCommand=z.discriminatedUnion('action',[
 z.object({...base,action:z.literal('settings'),settings:Settings}),
 z.object({...base,action:z.literal('snooze'),reminder:z.string().uuid(),seconds:z.number().int().min(1).max(300)}),
 z.object({...base,action:z.literal('password_reset'),newPassword:NewPassword}),
]);
export async function applyManagement(raw:unknown,device:string,now:number,seen:Set<string>,model:Reminder,passwords:PasswordManager,demoActive:boolean){
 const parsed=ManagementCommand.safeParse(raw);if(!parsed.success)return {outcome:'rejected',reason:'Invalid command'};
 const c=parsed.data;if(c.device!==device||c.expires<now||c.expires>now+60000||seen.has(c.id))return {outcome:'rejected',reason:'Stale or unauthorized command'};
 seen.add(c.id);
 try{
  if(c.action==='password_reset')await passwords.reset(c.newPassword);
  else if(demoActive)return {outcome:'rejected',reason:'End the demo first'};
  else if(c.action==='settings'){const changed=model.settings.minutes!==c.settings.minutes;model.settings=c.settings;if(changed&&!model.state.reminder)model.state={...model.state,due:now+c.settings.minutes*60000};}
  else if(!model.snooze(c.reminder,now,c.seconds))return {outcome:'rejected',reason:'Snooze already used or reminder changed'};
  return {outcome:'acknowledged',reason:''};
 }catch{return {outcome:'rejected',reason:'Password operation could not be applied'};}
}
// Never retain a password in command history, state snapshots or event logs.
export function commandSummary(command:z.infer<typeof ManagementCommand>){return {type:command.type,id:command.id,device:command.device,action:command.action,expires:command.expires,outcome:'pending',reason:''};}
export const ClientDetails=z.object({
 settings:Settings.optional(),due:z.number().finite().optional(),remainingMs:z.number().finite().nonnegative().optional(),
 snoozeUntil:z.number().finite().optional(),snoozeRemainingMs:z.number().finite().nonnegative().optional(),snoozeUsed:z.boolean().optional(),
 phase:z.enum(['offline','paused','outside-hours','snoozed','pending','deferred','scheduled','due']).optional(),
 displays:z.array(z.object({id:z.number().int(),label:z.string().max(200),width:z.number(),height:z.number(),primary:z.boolean()})).max(32).optional(),managementControls:z.boolean().optional(),
});
