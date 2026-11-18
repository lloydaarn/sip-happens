import type {Reminder} from './core';
export function reminderTiming(model:Reminder,online:boolean,deferred:boolean,now:number,hour=new Date(now).getHours()){
 const {state,settings:s}=model;
 const snoozeRemainingMs=state.reminder?Math.max(0,(state.snoozeUntil||0)-now):0;
 const active=s.start===s.end||(s.start<s.end?hour>=s.start&&hour<s.end:hour>=s.start||hour<s.end);
 const phase=!online?'offline':state.reminder?(snoozeRemainingMs?'snoozed':deferred?'deferred':'pending'):s.paused?'paused':!active?'outside-hours':state.due<=now?'due':'scheduled';
 return {phase,due:state.due,remainingMs:Math.max(0,state.due-now),snoozeUntil:state.snoozeUntil||0,snoozeRemainingMs,snoozeUsed:!!state.reminder&&state.snoozedReminder===state.reminder};
}
export function countdown(milliseconds:number){const seconds=Math.max(0,Math.ceil(milliseconds/1000));const hours=Math.floor(seconds/3600);const minutes=Math.floor(seconds/60)%60;return (hours?String(hours).padStart(2,'0')+':':'')+String(minutes).padStart(2,'0')+':'+String(seconds%60).padStart(2,'0');}
