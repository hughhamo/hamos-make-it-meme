// Pure rules shared by the game server and its automated tests.
export const MAX_TEXT=110;
export function sanitize(value,limit=32){return String(value??'').replace(/[<>\u0000-\u001f]/g,'').trim().slice(0,limit)}
export function scoreVotes(votes){if(!votes.length)return {rating:0,points:0,votes:0};const mean=votes.reduce((sum,stars)=>sum+stars,0)/votes.length;return {rating:Number(mean.toFixed(1)),points:Math.round(mean*100),votes:votes.length}}
export function validVote(stars){return Number.isInteger(stars)&&stars>=1&&stars<=5}
