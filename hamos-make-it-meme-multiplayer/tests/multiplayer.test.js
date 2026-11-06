import test from 'node:test';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {once} from 'node:events';
import WebSocket from 'ws';
const pause=ms=>new Promise(r=>setTimeout(r,ms));
test('five changes, reconnect persistence, submit lock and per-round reset', {timeout:25000},async()=>{
 const proc=spawn(process.execPath,['server/index.js'],{env:{...process.env,PORT:'18787'},stdio:['ignore','pipe','pipe']});
 const clients=[];
 try{
 await new Promise((resolve,reject)=>{proc.stdout.on('data',d=>{if(String(d).includes('running'))resolve()});proc.on('error',reject);proc.on('exit',()=>reject(Error('Server exited')))});
 async function client(){const ws=new WebSocket('ws://127.0.0.1:18787/ws',{origin:'https://hamosmakeitmeme.netlify.app'});clients.push(ws);const messages=[];ws.on('message',d=>messages.push(JSON.parse(d)));await once(ws,'open');return {ws,messages,async wait(fn){const end=Date.now()+10000;while(Date.now()<end){const i=messages.findIndex(fn);if(i>=0)return messages.splice(i,1)[0];await pause(10)}throw Error('Missing expected message')},async send(m){await pause(110);messages.length=0;ws.send(JSON.stringify(m))}}}
 const a=await client(),b=await client();const welcome=await a.wait(m=>m.type==='welcome');await b.wait(m=>m.type==='welcome');
 await a.send({type:'create',name:'Host',private:true,rounds:2});let r=(await a.wait(m=>m.type==='state')).room;
 await b.send({type:'join',code:r.code,name:'Guest'});await b.wait(m=>m.type==='state');await b.send({type:'ready',ready:true});await b.wait(m=>m.type==='state');await a.send({type:'start'});r=(await a.wait(m=>m.room?.phase==='caption')).room;
 for(let i=4;i>=0;i--){const old=r.template.url;await a.send({type:'changeMeme'});r=(await a.wait(m=>m.type==='state')).room;assert.equal(r.changesLeft,i);assert.notEqual(r.template.url,old)}
 await a.send({type:'changeMeme'});assert.match((await a.wait(m=>m.type==='error')).message,/five/);
 const resumed=await client();await resumed.wait(m=>m.type==='welcome');await resumed.send({type:'resume',token:welcome.token});r=(await resumed.wait(m=>m.type==='state')).room;assert.equal(r.changesLeft,0);
 await resumed.send({type:'submit',captions:['hello']});await resumed.wait(m=>m.room?.yourSubmitted);await resumed.send({type:'changeMeme'});assert.match((await resumed.wait(m=>m.type==='error')).message,/submitted/);
 await b.send({type:'submit',captions:['world']});let vote=(await b.wait(m=>m.room?.phase==='vote')).room;
 for(let i=0;i<2;i++){const voter=vote.currentMeme.isOwnMeme?resumed:b;await voter.send({type:'vote',stars:5});if(i===0)vote=(await b.wait(m=>m.room?.phase==='vote'&&m.room.voteIndex===1)).room;}
 r=(await resumed.wait(m=>m.room?.round===2&&m.room.phase==='caption')).room;assert.equal(r.changesLeft,5);assert.equal(r.yourSubmitted,false);
 }finally{clients.forEach(w=>w.terminate());proc.kill();await once(proc,'exit')}
});
