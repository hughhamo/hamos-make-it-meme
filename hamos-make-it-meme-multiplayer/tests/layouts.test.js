import test from 'node:test';import assert from 'node:assert/strict';import {templateWithLayout,normalizeCaptions} from '../server/layouts.js';
test('Three caption zones are returned for a character-label meme',()=>{const t=templateWithLayout({name:'Distracted Boyfriend',url:'https://example.com/a.jpg'});assert.equal(t.captionCount,3);assert.equal(t.slots.length,3)});
test('Two distinct caption zones returned for classic meme',()=>{const t=templateWithLayout({name:'Drake Hotline Bling',url:'https://example.com/a.jpg'});assert.equal(t.captionCount,2);assert.ok(t.slots[0].y<t.slots[1].y)});
test('Single caption zone available for reaction memes',()=>{assert.equal(templateWithLayout({name:'Waiting Skeleton',url:'https://example.com/a.jpg'}).captionCount,1)});
test('Caption arrays capped at template fields',()=>{assert.deepEqual(normalizeCaptions(['A','B','C'],2),['A','B'])});
