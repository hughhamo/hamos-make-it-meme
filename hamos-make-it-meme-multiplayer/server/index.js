import express from 'express';
import {createServer} from 'node:http';
import {WebSocketServer,WebSocket} from 'ws';
import crypto from 'node:crypto';
import {MAX_TEXT,sanitize,scoreVotes,validVote} from './rules.js';
import {templateWithLayout} from './layouts.js';

// Keep the deployed game origin available alongside additional configured origins.
const allowedOrigins = ['https://hamosmakeitmeme.netlify.app', ...(process.env.ALLOWED_ORIGINS ?? 'http://localhost:5173,http://localhost:8787').split(',')].map(origin => origin.trim().replace(/\/$/, '')).filter(Boolean);

const app=express();app.use((req,res,next)=>{const origin=req.headers.origin;const allowed=allowedOrigins;if(origin&&allowed.includes(origin)){res.setHeader('Access-Control-Allow-Origin',origin);res.setHeader('Vary','Origin')}if(req.method==='OPTIONS'){res.status(204).end();return}next()});const server=createServer(app);const wss=new WebSocketServer({server,path:'/ws',maxPayload:8192});
const rooms=new Map(),clients=new Map();let online=0;
// Meme images load from a third-party source, not distributed with this project.
// Review the provider's terms and individual template rights before public deployment.
const FALLBACK_MEMES=[
 {name:'Drake Hotline Bling',url:'https://i.imgflip.com/30b1gx.jpg'},
 {name:'Distracted Boyfriend',url:'https://i.imgflip.com/1ur9b0.jpg'},
 {name:'Two Buttons',url:'https://i.imgflip.com/1g8my4.jpg'},
 {name:'Change My Mind',url:'https://i.imgflip.com/24y43o.jpg'},
 {name:'One Does Not Simply',url:'https://i.imgflip.com/1bij.jpg'},
 {name:'Expanding Brain',url:'https://i.imgflip.com/1jwhww.jpg'},
 {name:'Left Exit 12 Off Ramp',url:'https://i.imgflip.com/22bdq6.jpg'},
 {name:'Running Away Balloon',url:'https://i.imgflip.com/261o3j.jpg'}
];
let memeLibrary=FALLBACK_MEMES.map(templateWithLayout);
async function loadTemplates(){
 try{const response=await fetch('https://api.imgflip.com/get_memes',{signal:AbortSignal.timeout(5000)});const json=await response.json();
 const list=json?.data?.memes?.filter(m=>typeof m.name==='string'&&m.url.startsWith('https://')&&m.width>=250&&m.height>=180&&m.box_count<=3).map(m=>({name:sanitize(m.name,65),url:m.url,width:m.width,height:m.height,box_count:m.box_count,source:'Imgflip popularity feed'})).map(templateWithLayout);
 if(json.success&&list?.length)memeLibrary=list;
 console.log(`HAMOS template library: ${memeLibrary.length} templates`);
 }catch(e){console.warn('Meme API unavailable; using fallback templates:',e.message)}
}
loadTemplates();
const sessions=new Map(); // reconnect token -> stable identity and room; lives until room cleanup
function safeTemplate(t){return t&&typeof t.url==='string'?t:templateWithLayout(FALLBACK_MEMES[0])}

const choices=['🫠','🦝','🛸','👽','🐸','🦖','🧠','🥶','🪿','💀','🤖','🥑','🐢','🐈','🐕','🌚','👀','🔥','🐧','⚡','🍕','👑','🦀','🦈','🕶️','🫡','💸','🦆','🥸','🐙','🎭','🌭','🥔','🤯','🌝','🧊','🥹','🐵','🦄','🫥','🍄','🦉','🧃','🤠','🪩','😤','🙃','👻','🧌','🎩'];
const phases=['lobby','caption','vote','results','finished'];
function send(ws,type,payload={}){if(ws?.readyState===WebSocket.OPEN)ws.send(JSON.stringify({type,...payload}))}
function roomCode(){let x;do{x=crypto.randomBytes(3).toString('hex').toUpperCase()}while(rooms.has(x));return x}
function publicRooms(){return [...rooms.values()].filter(r=>!r.private&&r.phase==='lobby').map(r=>({code:r.code,players:r.players.size,capacity:r.capacity,mode:r.mode,host:r.players.get(r.host)?.name??'Host'}))}
function roomState(r,viewer){return {code:r.code,private:r.private,phase:r.phase,mode:r.mode,round:r.round,rounds:r.rounds,captionTime:r.captionTime,voteTime:r.voteTime,deadline:r.deadline,host:r.host,capacity:r.capacity,players:[...r.players.values()].map(p=>({id:p.id,name:p.name,emoji:p.emoji,score:p.score,ready:p.ready,connected:p.connected})),you:viewer,template:r.playerTemplates?.get(viewer)??r.template,yourSubmitted:r.submissions.has(viewer),submitted:r.submissions.size,voteIndex:r.voteIndex,voteCount:r.voteOrder.length,currentMeme:r.phase==='vote'?(()=>{const target=r.voteOrder[r.voteIndex];const meme=r.submissions.get(target);return meme?{captions:meme.captions,template:meme.template,isOwnMeme:target===viewer}:null})():null,results:r.results??[],champion:r.champion??null,hallOfFame:r.phase==='finished'?r.hallOfFame.slice().sort((a,b)=>b.points-a.points).slice(0,10):[]}}
function broadcastRoom(r){for(const p of r.players.values())send(p.ws,'state',{room:roomState(r,p.id)})}
function broadcastLobby(){for(const ws of clients.keys())send(ws,'lobbies',{rooms:publicRooms(),online})}
function err(ws,message){send(ws,'error',{message})}
function clearClock(r){if(r.timeout){clearTimeout(r.timeout);r.timeout=null}}
function schedule(r,seconds,callback){clearClock(r);r.deadline=Date.now()+seconds*1000;r.timeout=setTimeout(()=>{if(rooms.has(r.code))callback(r)},seconds*1000+100)}
function chooseTemplate(r){const available=memeLibrary.filter(t=>!r.usedTemplates.includes(t.url));const list=available.length?available:memeLibrary;const t=safeTemplate(list[crypto.randomInt(list.length)]);r.usedTemplates.push(t.url);return t}
function moveRound(r){r.round++;r.phase='caption';r.submissions=new Map();r.votes=new Map();r.results=[];r.voteOrder=[];r.voteIndex=0;r.template=chooseTemplate(r);r.playerTemplates=new Map();for(const id of r.players.keys())r.playerTemplates.set(id,r.mode==='same'?r.template:chooseTemplate(r));schedule(r,r.mode==='quick'?30:r.captionTime,beginVoting);broadcastRoom(r)}
function beginVoting(r){if(r.phase!=='caption')return;r.phase='vote';r.voteOrder=[...r.submissions.keys()];for(let i=r.voteOrder.length-1;i>0;i--){let j=crypto.randomInt(i+1);[r.voteOrder[i],r.voteOrder[j]]=[r.voteOrder[j],r.voteOrder[i]]}r.voteIndex=0;if(!r.voteOrder.length){finishRound(r);return}nextVote(r)}
function nextVote(r){if(r.voteIndex>=r.voteOrder.length){finishRound(r);return}r.votes.set(r.voteOrder[r.voteIndex],new Map());schedule(r,r.mode==='quick'?8:r.voteTime,()=>{r.voteIndex++;nextVote(r)});broadcastRoom(r)}
function finishRound(r){clearClock(r);r.results=[...r.submissions.entries()].map(([id,meme])=>{const votes=r.votes.get(id);const vals=votes?[...votes.values()]:[];const {points,rating}=scoreVotes(vals);const p=r.players.get(id);if(p)p.score+=points;return {...meme,author:p?.name??'Player',points,rating,votes:vals.length}}).sort((a,b)=>b.points-a.points);r.phase='results';r.hallOfFame.push(...r.results.map(x=>({...x,round:r.round})));schedule(r,7,()=>{if(r.round>=r.rounds){r.phase='finished';r.deadline=null;r.champion=[...r.players.values()].sort((a,b)=>b.score-a.score)[0]?.id??null;broadcastRoom(r)}else moveRound(r)});broadcastRoom(r)}
function removePlayer(ws){const c=clients.get(ws);if(!c)return;
 const r=rooms.get(c.room);if(r){const p=r.players.get(c.id);if(p&&p.ws===ws){p.ws=null;p.connected=false;p.lastSeen=Date.now();
 if(r.host===c.id){const next=[...r.players.values()].find(x=>x.connected&&x.id!==c.id);if(next)r.host=next.id;}
 broadcastRoom(r)}}clients.delete(ws);online=Math.max(0,online-1);broadcastLobby()}
function leaveRoom(ws,r,c){const p=r.players.get(c.id);if(p)r.players.delete(c.id);sessions.delete(c.token);r.submissions.delete(c.id);r.playerTemplates?.delete(c.id);c.room=null;
 if(!r.players.size){clearClock(r);rooms.delete(r.code)}else{if(r.host===c.id)r.host=[...r.players.values()].find(p=>p.connected)?.id??r.players.keys().next().value;
 if(r.phase==='caption'&&[...r.players.values()].filter(p=>p.connected).every(p=>r.submissions.has(p.id)))beginVoting(r);else broadcastRoom(r)}broadcastLobby()}
function join(ws,r,name){if(!r||r.players.size>=r.capacity||r.phase!=='lobby'){err(ws,'Room unavailable, full or already in a match.');return}if(clients.get(ws)?.room){err(ws,'You are already in a room.');return}const id=clients.get(ws).id;const p={id,name:sanitize(name,20)||'Guest',emoji:choices[crypto.randomInt(choices.length)],score:0,ready:false,connected:true,ws};r.players.set(id,p);clients.get(ws).room=r.code;sessions.set(clients.get(ws).token,{id,room:r.code});if(!r.host)r.host=id;broadcastRoom(r);broadcastLobby()}
const rate=new WeakMap();
wss.on('connection',(ws,req)=>{const origin=req.headers.origin??'';const allowed=allowedOrigins;if(origin&&!allowed.includes(origin)){ws.close(1008,'Origin not allowed');return}const id=crypto.randomUUID();const token=crypto.randomBytes(24).toString('hex');clients.set(ws,{id,token,room:null});sessions.set(token,{id,room:null});online++;send(ws,'welcome',{id,token,online,rooms:publicRooms()});broadcastLobby();ws.on('message',data=>{try{const last=rate.get(ws)??0;if(Date.now()-last<90)return;rate.set(ws,Date.now());const m=JSON.parse(data.toString());const c=clients.get(ws),r=rooms.get(c.room);if(!c||!m||typeof m.type!=='string')return;
 switch(m.type){
 case 'resume':{const record=sessions.get(sanitize(m.token,64));const prev=record&&rooms.get(record.room);const player=prev?.players.get(record.id);if(!prev||!player)return err(ws,'Previous room is no longer available.');
 const other=clients.get(ws);if(other.room)return;const oldWs=player.ws;if(oldWs&&oldWs!==ws&&oldWs.readyState===WebSocket.OPEN)oldWs.close(4000,'Session resumed elsewhere');
 sessions.delete(other.token);other.id=record.id;other.token=m.token;other.room=prev.code;player.ws=ws;player.connected=true;player.lastSeen=Date.now();if(!prev.players.get(prev.host)?.connected)prev.host=record.id;
 send(ws,'welcome',{id:record.id,token:m.token,online,rooms:publicRooms()});broadcastRoom(prev);break}
 case 'create':{if(r)return err(ws,'Leave your current game first.');const code=roomCode();const mode=['classic','same','quick','custom'].includes(m.mode)?m.mode:'classic';const nr={code,private:!!m.private,mode,host:null,capacity:Math.max(2,Math.min(12,Number(m.capacity)||12)),rounds:Math.max(1,Math.min(10,Number(m.rounds)||3)),captionTime:Math.max(20,Math.min(180,Number(m.captionTime)||60)),voteTime:Math.max(5,Math.min(45,Number(m.voteTime)||15)),phase:'lobby',round:0,players:new Map(),submissions:new Map(),votes:new Map(),usedTemplates:[],results:[],hallOfFame:[],deadline:null,timeout:null,template:templateWithLayout(FALLBACK_MEMES[0]),playerTemplates:new Map(),voteOrder:[],voteIndex:0};rooms.set(code,nr);join(ws,nr,m.name);break}
 case 'join':{if(r)return err(ws,'Leave your current game first.');join(ws,rooms.get(sanitize(m.code,8).toUpperCase()),m.name);break}
 case 'leave':{if(!r)return;leaveRoom(ws,r,c);sessions.set(c.token,{id:c.id,room:null});break}
 case 'ready':{if(!r||r.phase!=='lobby')return;const p=r.players.get(c.id);if(p){p.ready=!!m.ready;broadcastRoom(r)}break}
 case 'start':{if(!r||r.phase!=='lobby'||r.host!==c.id)return;if(r.players.size<2)return err(ws,'At least two players are required to start.');if([...r.players.values()].some(p=>p.id!==r.host&&(!p.ready||!p.connected)))return err(ws,'All other players must be ready.');moveRound(r);broadcastLobby();break}
 case 'submit':{if(!r||r.phase!=='caption'||r.submissions.has(c.id)||Date.now()>r.deadline)return;const template=r.playerTemplates.get(c.id)??r.template;const input=Array.isArray(m.captions)?m.captions:[m.top,m.bottom];const captions=Array.from({length:template.captionCount??2},(_,i)=>sanitize(input[i],MAX_TEXT));if(!captions.some(Boolean))return err(ws,'Write a caption before submitting.');r.submissions.set(c.id,{id:c.id,captions,template});if([...r.players.values()].filter(p=>p.connected).every(p=>r.submissions.has(p.id)))beginVoting(r);else broadcastRoom(r);break}
 case 'vote':{if(!r||r.phase!=='vote'||Date.now()>r.deadline)return;const target=r.voteOrder[r.voteIndex];if(!target||target===c.id)return;const votes=r.votes.get(target);const stars=Number(m.stars);if(!votes||votes.has(c.id)||!validVote(stars))return;votes.set(c.id,stars);send(ws,'voteAccepted',{});const eligible=[...r.players.values()].filter(p=>p.id!==target&&p.connected).map(p=>p.id);if(eligible.every(id=>votes.has(id))){clearClock(r);r.voteIndex++;nextVote(r)}break}
 case 'again':{if(!r||r.phase!=='finished'||r.host!==c.id)return;r.phase='lobby';r.round=0;r.champion=null;r.deadline=null;r.usedTemplates=[];r.hallOfFame=[];r.players.forEach(p=>{p.score=0;p.ready=false});broadcastRoom(r);broadcastLobby();break}
 default:break
 }
 }catch(e){err(ws,'Invalid game message.')}});ws.on('close',()=>removePlayer(ws));ws.on('error',()=>{});});
setInterval(()=>{const now=Date.now();for(const r of rooms.values()){
  for(const p of r.players.values())if(!p.connected&&now-(p.lastSeen||now)>120000){r.players.delete(p.id);r.submissions.delete(p.id);r.playerTemplates?.delete(p.id)}
  if(!r.players.size){clearClock(r);rooms.delete(r.code)}else if(!r.players.get(r.host)){r.host=[...r.players.values()].find(p=>p.connected)?.id??r.players.keys().next().value;broadcastRoom(r)}
 }
 for(const [token,record] of sessions)if(!record.room||!rooms.has(record.room))sessions.delete(token);
},30000).unref();
app.get('/api/health' ,(_req,res)=>res.json({ok:true,online,rooms:rooms.size}));
app.get('/api/templates',(_req,res)=>res.json({count:memeLibrary.length,source:memeLibrary===undefined?'none':'live source or fallback',verifiedAssetCount:null,templates:memeLibrary.map(t=>({name:t.name,url:t.url,slots:t.slots,captionCount:t.captionCount}))}));
app.use(express.static(new URL('../public',import.meta.url).pathname));const port=Number(process.env.PORT)||8787;server.listen(port,'0.0.0.0',()=>console.log(`HAMOS server running on ${port}`));
