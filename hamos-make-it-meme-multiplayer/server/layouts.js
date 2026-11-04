// Curated placement recipes for templates whose built-in illustration has distinct labels.
// Each slot uses percentages of displayed image bounds. The client scales text to fit.
const standard=[{x:3,y:2,w:94,h:20},{x:3,y:76,w:94,h:21}];
const reaction=[{x:4,y:3,w:92,h:20}];
const layouts=[
 {match:/two buttons/i,slots:[{x:3,y:1,w:47,h:18},{x:51,y:1,w:46,h:18},{x:27,y:70,w:46,h:19}]},
 {match:/distracted boyfriend/i,slots:[{x:0,y:59,w:30,h:17},{x:35,y:48,w:30,h:17},{x:70,y:58,w:29,h:17}]},
 {match:/drake hotline bling/i,slots:[{x:48,y:5,w:49,h:37},{x:48,y:55,w:49,h:38}]},
 {match:/change my mind/i,slots:[{x:30,y:60,w:58,h:25}]},
 {match:/one does not simply/i,slots:standard},
 {match:/left exit 12 off ramp/i,slots:[{x:1,y:0,w:46,h:17},{x:52,y:0,w:46,h:17}]},
 {match:/running away balloon/i,slots:[{x:3,y:3,w:38,h:19},{x:60,y:2,w:38,h:19},{x:55,y:73,w:42,h:20}]},
 {match:/expanding brain/i,slots:[{x:0,y:2,w:47,h:20},{x:0,y:70,w:47,h:23}]},
 {match:/waiting skeleton|boardroom meeting suggestion|ancient aliens/i,slots:reaction}
];
export function templateWithLayout(m){
 const pattern=layouts.find(x=>x.match.test(m.name));
 const count=pattern?pattern.slots.length:2;
 return {...m,slots:(pattern?pattern.slots:standard).map(s=>({...s})),captionCount:count};
}
export function normalizeCaptions(input,count){const a=Array.isArray(input)?input:[];return Array.from({length:count},(_,i)=>String(a[i]??'').slice(0,110));}
