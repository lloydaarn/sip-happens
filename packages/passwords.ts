import {hashPassword,verifyPassword} from './core';
import {z} from 'zod';
export type PasswordRecord={salt:string;hash:string};
export const NewPassword=z.string().min(10,'Use at least 10 characters').max(256);
export class PasswordManager {
 private busy=false;private retryAt=0;
 constructor(private read:()=>PasswordRecord|undefined,private write:(record:PasswordRecord)=>void,private now=()=>Date.now()){}
 private async run<T>(work:()=>Promise<T>){if(this.busy)throw Error('Another password operation is in progress');this.busy=true;try{return await work();}finally{this.busy=false;}}
 private async verify(password:string){if(this.now()<this.retryAt)throw Error('Please wait before trying again');const record=this.read();if(!record||!await verifyPassword(password,record)){this.retryAt=this.now()+3000;throw Error('Incorrect password');}}
 async authenticate(password:string){z.string().max(256).parse(password);return this.run(async()=>{if(!this.read()){NewPassword.parse(password);this.write(await hashPassword(password));return 'created';}await this.verify(password);return 'verified';});}
 async change(current:string,next:string){z.string().max(256).parse(current);NewPassword.parse(next);return this.run(async()=>{await this.verify(current);this.write(await hashPassword(next));});}
 async reset(next:string){NewPassword.parse(next);return this.run(async()=>{this.write(await hashPassword(next));this.retryAt=0;});}
}
