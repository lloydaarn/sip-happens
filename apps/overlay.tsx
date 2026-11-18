import React,{useEffect,useState} from 'react';
import './overlay.css';
type Slide={image:string;alt:string;meme?:boolean;tag?:string;title?:string;body?:string;credit?:string};
const slides:Slide[]=[
 {image:'thirst.png',alt:'Kitten with I smell dehydration and go drink water text',meme:true},
 {image:'fatigue.jpg',alt:'A tired woman resting her head beside her laptop',tag:'02 / Your energy',title:'Running low can feel tiring.',body:'Dehydration can leave you feeling tired. Step away from the screen for a moment and check in with how you feel.',credit:'Andrea Piacquadio / Pexels 3791136'},
 {image:'headache.png',alt:'A woman holding both temples with her eyes closed',tag:'03 / How you feel',title:'Headache. Dizziness. A signal to check in.',body:'Headaches and feeling light-headed can occur with dehydration. These symptoms can have other causes too; persistent or severe symptoms need medical advice.',credit:'User-supplied image'},
 {image:'meme-1.png',alt:'Cat pointing at water with Drink water text',meme:true},
 {image:'meme-2.png',alt:'Black and white cat with water and Drink water text',meme:true},
 {image:'meme-3.png',alt:'Black cat pointing at a bottle with Drink water text',meme:true},
 {image:'meme-4.png',alt:'Cat with I smell dehydration text',meme:true},
];
export function Overlay({state:s,call,error}:{state:any;call:(action:string,data?:any)=>Promise<void>;error:string}){
 const [index,setIndex]=useState(0),[paused,setPaused]=useState(()=>window.matchMedia('(prefers-reduced-motion: reduce)').matches),[password,setPassword]=useState('');
 useEffect(()=>{if(paused)return;const timer=setInterval(()=>setIndex(i=>(i+1)%slides.length),12000);return()=>clearInterval(timer);},[paused,index]);
 const slide=slides[index];
 return <div className="hydration-overlay"><aside className="reminder-panel">
  <header className="overlay-brand"><span className="drop-mark" aria-hidden="true">◒</span><span>SIP HAPPENS<small>YOUR WATER BREAK · v{s.updates.version}</small></span></header>
  <div className="reminder-copy"><span className="eyebrow">A MOMENT FOR YOURSELF</span><h1>Pause.<br/>Sip.<br/><em>Reset.</em></h1><p>A little water.<br/>A fresh start for the next part of your day.</p></div>
  <div className="unlock-card"><div className="connection-pill"><span className={s.connected?'status-dot online':'status-dot'}/>{s.connected?'Admin connected':'Admin offline'}</div><h2>Your break is waiting.</h2><p>{s.connected?'Your admin can acknowledge this reminder remotely.':'Use your local password to acknowledge this reminder.'}</p>
   {s.configured?<form onSubmit={async e=>{e.preventDefault();await call('password',password);setPassword('');}}><label htmlFor="unlock-password">Local unlock password</label><input id="unlock-password" type="password" autoComplete="current-password" value={password} onChange={e=>setPassword(e.target.value)} maxLength={256} placeholder="Enter your password"/><button type="submit">Unlock reminder ↗</button></form>:<p>No local password is configured. Use the admin to unlock, or end this demo below.</p>}
   {error&&<p role="alert" className="error">{error}</p>}
  </div>
  <div className="slide-controls"><div className="slide-dots">{slides.map((item,i)=><button key={item.image} aria-label={'Show slide '+(i+1)} aria-pressed={i===index} className={i===index?'selected':''} onClick={()=>setIndex(i)}/>)}</div><button className="quiet-button" onClick={()=>setPaused(!paused)}>{paused?'Play slideshow':'Pause slideshow'}</button><button className="quiet-button" onClick={()=>setIndex((index+1)%slides.length)}>Next →</button></div>
  <footer className="reminder-footer">{s.remoteDemo?<><span className="demo-badge">DEMO ACTIVE</span><button className="quiet-button" onClick={()=>call('stopDemo')}>End demo & restore schedule</button></>:<small>One pause. One reminder. Take your time.</small>}</footer>
 </aside><section className={'slideshow '+(slide.meme?'meme-slide':'')} aria-label="Hydration information slideshow">
  {slides.map((item,i)=><img key={item.image} className={'slide-photo '+(item.meme?'meme-photo ':'')+(index===i?'visible':'')} src={'assets/'+item.image} alt={index===i?item.alt:''} aria-hidden={index!==i}/>)}
  {!slide.meme&&<><div className="photo-shade"/><div className="slideshow-top"><span>FEEL BETTER, ONE BREAK AT A TIME</span><span>{String(index+1).padStart(2,'0')} / {String(slides.length).padStart(2,'0')}</span></div>
  <div className="slide-caption"><span className="eyebrow">{slide.tag}</span><h2>{slide.title}</h2><p>{slide.body}</p><div className="slide-credits"><span>Health information: NHS · nhs.uk/conditions/dehydration</span><span>Stock photo: {slide.credit} · Posed symptom illustration</span></div></div></>}
 </section></div>;
}
