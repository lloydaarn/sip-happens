import {z} from 'zod';
import {Reminder} from './core';
import {DemoSession} from './demo';
export const RemoteDemoCommand=z.object({type:z.literal('demo'),id:z.string().uuid(),device:z.string().uuid(),expires:z.number(),event:z.enum(['reminder','fullscreen','no-spare','normal','resume','stop'])});
export class RemoteDemo {
 session?:DemoSession;
 original?:{state:Reminder['state'];settings:Reminder['settings']};
 expires=0;
 constructor(private model:Reminder){}
 apply(raw:unknown,device:string,now:number,seen:Set<string>){
  const parsed=RemoteDemoCommand.safeParse(raw);
  if(!parsed.success)return 'rejected';
  const c=parsed.data;
  if(c.device!==device||c.expires<now||c.expires>now+60000||seen.has(c.id))return 'rejected';
  seen.add(c.id);
  if(c.event==='stop'){this.stop();return 'acknowledged';}
  if(!this.session){
   if(this.model.state.reminder)return 'rejected';
   this.original={state:{...this.model.state},settings:{...this.model.settings}};
   this.model.state={...this.model.state};this.model.settings={...this.model.settings,paused:false,start:0,end:0};
   this.session=new DemoSession(this.model);
  }
  this.expires=now+300000;
  if(c.event==='reminder')this.session.apply('normal',now);
  this.session.apply(c.event,now);
  return 'acknowledged';
 }
 stop(){if(this.original){this.model.state={...this.original.state};this.model.settings={...this.original.settings};}this.original=undefined;this.session=undefined;this.expires=0;}
 tick(now:number){if(this.session&&now>=this.expires){this.stop();return true;}return false;}
}
