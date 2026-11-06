import test from 'node:test';import assert from 'node:assert/strict';import vm from 'node:vm';import {readFileSync} from 'node:fs';
test('hidden screen removes captions and image; show restores them; voting unhides',()=>{
 const elements=new Map();const el=id=>{if(!elements.has(id))elements.set(id,{innerHTML:'',textContent:'',classList:{add(){},remove(){},toggle(){}}});return elements.get(id)};
 class Socket{constructor(){this.readyState=1}send(){}}
 const context=vm.createContext({document:{getElementById:el,querySelectorAll:()=>[],addEventListener(){}},window:{HAMOS_BACKEND_URL:'http://localhost:8787',addEventListener(){}},location:{search:'',origin:'http://localhost:8787',protocol:'http:',pathname:'/'},localStorage:{getItem(){return ''}},sessionStorage:{getItem(){return ''},setItem(){}},history:{replaceState(){}},WebSocket:Socket,URLSearchParams,setInterval(){},setTimeout(){},fetch:async()=>{throw Error('offline')},matchMedia:()=>({matches:true})});
 vm.runInContext(readFileSync(new URL('../public/game.js',import.meta.url),'utf8'),context);
 vm.runInContext("room={code:'ABC123',phase:'caption',round:1,rounds:2,players:[{id:'a'}],template:fallback,yourSubmitted:true,submitted:1,changesLeft:3};captions=['SECRET JOKE'];screenHidden=true;render()",context);
 assert.match(el('app').innerHTML,/POKER FACE/);assert.doesNotMatch(el('app').innerHTML,/SECRET JOKE|<img|data-input/);
 el('showScreen').onclick();assert.match(el('app').innerHTML,/SECRET JOKE/);assert.match(el('app').innerHTML,/HIDE MY SCREEN/);
 el('hideScreen').onclick();assert.doesNotMatch(el('app').innerHTML,/SECRET JOKE/);
 vm.runInContext("socket.onmessage({data:JSON.stringify({type:'state',room:{...room,phase:'vote',voteIndex:0,voteCount:1,currentMeme:{template:fallback,captions:['PUBLIC VOTE'],isOwnMeme:false}}})})",context);
 assert.match(el('app').innerHTML,/PUBLIC VOTE/);assert.doesNotMatch(el('app').innerHTML,/POKER FACE/);
});
