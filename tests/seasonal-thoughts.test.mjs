import {test} from 'node:test';
import assert from 'node:assert/strict';
import '../seasonal-thoughts.js';
const T=globalThis.hpSeasonalThoughts,random=()=>0.25,session={user:{id:'member-a'}};

test('thoughts match all seasonal themes and rotate through each collection without an immediate repeat',()=>{
 for(const [day,season] of [['2026-02-28','winter'],['2026-03-01','spring'],['2026-05-31','spring'],['2026-06-01','summer'],['2026-09-01','autumn'],['2026-12-01','christmas'],['2027-01-01','winter']]){
  assert.equal(T.seasonFor(day),season);let state={},last=null;const seen=new Set();
  for(let i=0;i<16;i++){const next=T.nextThought(state,random,day);assert.equal(next.thought.season,season);assert.notEqual(next.thought.id,last);if(i<8)seen.add(next.thought.id);assert.ok(next.thought.text.length>25);state=next.state;last=next.thought.id}
  assert.equal(seen.size,8);
 }
});
test('new connections and reopening change the thought while duplicate auth events leave it stable',()=>{
 let stored=null;const options={read:()=>stored,write:v=>stored=v,random,onDate:()=> '2026-09-12'};
 const rotate=T.createRotation(options);assert.deepEqual(rotate('INITIAL_SESSION',null),{hide:true});
 const first=rotate('SIGNED_IN',session).thought.id;
 for(const event of ['SIGNED_IN','INITIAL_SESSION','TOKEN_REFRESHED','USER_UPDATED','DAY_CHECK'])assert.equal(rotate(event,session),null);
 rotate('SIGNED_OUT',null);const second=rotate('SIGNED_IN',session).thought.id;assert.notEqual(first,second);
 const third=T.createRotation(options)('INITIAL_SESSION',session).thought.id;assert.notEqual(second,third);
 assert.ok(!stored.includes(session.user.id));assert.ok(!stored.includes('token'));
});
test('a new day changes the thought and a season change selects the new collection',()=>{
 let date='2026-11-29';const rotate=T.createRotation({random,onDate:()=>date});const first=rotate('SIGNED_IN',session).thought.id;
 date='2026-11-30';const second=rotate('DAY_CHECK').thought;assert.notEqual(second.id,first);assert.equal(second.season,'autumn');
 date='2026-12-01';assert.equal(rotate('DAY_CHECK').thought.season,'christmas');
 rotate('SIGNED_OUT',null);date='2026-12-02';assert.equal(rotate('DAY_CHECK'),null);
});
test('blocked storage and malformed preferences cannot prevent rotation or login',()=>{
 for(const read of [()=>'{broken',()=> 'null',()=>JSON.stringify({version:1,season:'autumn',remaining:['unknown','unknown']}),()=>{throw Error('blocked')}]){
  const rotate=T.createRotation({read,write:()=>{throw Error('quota')},random,onDate:()=> '2026-09-12'});
  const first=rotate('SIGNED_IN',session).thought.id;rotate('SIGNED_OUT',null);assert.notEqual(rotate('SIGNED_IN',session).thought.id,first);
 }
});
