import test from 'node:test';
import assert from 'node:assert/strict';
import {sanitize,scoreVotes,validVote,hasHiddenSkipWord} from '../server/rules.js';
test('averages normalized across different numbers of votes',()=>{
 assert.deepEqual(scoreVotes([5]),{rating:5,points:500,votes:1});
 assert.deepEqual(scoreVotes([5,5,5]),{rating:5,points:500,votes:3});
 assert.deepEqual(scoreVotes([1,5]),{rating:3,points:300,votes:2});
});
test('no votes scores zero without inventing ratings',()=>{
 assert.deepEqual(scoreVotes([]),{rating:0,points:0,votes:0});
});
test('invalid star values cannot be accepted',()=>{
 for(const n of [0,6,1.5,NaN,Infinity,-1])assert.equal(validVote(n),false);
 for(const n of [1,2,3,4,5])assert.equal(validVote(n),true);
});
test('user captions are bounded and stripped of markup delimiters',()=>{
 assert.equal(sanitize('<h1>Hi</h1>'),'h1Hi/h1');
 assert.equal(sanitize('a'.repeat(200),110).length,110);
});
test('hidden skip words match only as standalone words, case-insensitively',()=>{
 for(const word of ['Hamo','hamo','HAMO','Hugh','HUGH','Hami','Hamu','(Hamo!)','say Hugh, please'])assert.equal(hasHiddenSkipWord(word),true,word);
 for(const text of ['hamometer','Hughie','I like ham','shamoo','hamo123','123hamo','Hamiya'])assert.equal(hasHiddenSkipWord(text),false,text);
});
