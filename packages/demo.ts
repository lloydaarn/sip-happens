import {z} from 'zod';
import {Reminder, defaults} from './core';
export const DemoEvent = z.enum(['reminder','fullscreen','no-spare','normal','offline','reconnect','resume','reset']);
export class DemoSession {
  placement: 'normal' | 'fullscreen' | 'no-spare' = 'normal';
  offline = false;
  graceUntil = 0;
  lastEvent = 'Ready';
  constructor(private model: Reminder) {}
  apply(input: unknown, now: number) {
    const event = DemoEvent.parse(input);
    this.lastEvent = event;
    if (event === 'reset') {
      this.model.settings = {...defaults};
      this.model.state = {due: now + defaults.minutes * 60000};
      this.placement = 'normal'; this.offline = false; this.graceUntil = 0;
    } else if (event === 'offline' || event === 'reconnect') {
      this.offline = event === 'offline';
    } else if (event === 'resume') {
      this.model.state.due = now - 1;
      this.graceUntil = now + 15000;
    } else if (event === 'reminder') {
      this.graceUntil = 0;
      this.model.state.due = now;
      const settings = this.model.settings;
      this.model.settings = {...settings, paused: false, start: 0, end: 0};
      this.model.tick(now, 0);
      this.model.settings = settings;
    } else {
      this.placement = event;
      this.model.settings = {...this.model.settings, game: event !== 'normal'};
    }
  }
  occupied(displays: number[]) {
    return this.placement === 'no-spare' ? displays : this.placement === 'fullscreen' ? displays.slice(0,1) : [];
  }
}
