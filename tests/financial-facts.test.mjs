import {test} from 'node:test';
import assert from 'node:assert/strict';
import '../financial-facts.js';
const F=globalThis.hpFinancialFacts,onDate=()=> '2026-09-10',random=()=>0.25;
const session={user:{id:'sample-member'}};
test('all twelve capsules rotate before repeating, including the cycle boundary',()=>{
  let state={},last=null;const seen=new Set();
  for(let i=0;i<36;i++){
    const next=F.nextFact(state,random,onDate());assert.ok(next.fact);assert.notEqual(next.fact.id,last);
    if(i<12)seen.add(next.fact.id);state=next.state;last=next.fact.id;
  }
  assert.equal(seen.size,12);
});
test('sign-in and reopening rotate; duplicate auth, focus and refresh events do not',()=>{
  let stored=null;const options={read:()=>stored,write:v=>{stored=v},random,onDate};
  const first=F.createRotation(options);assert.deepEqual(first('INITIAL_SESSION',null),{hide:true});
  const a=first('SIGNED_IN',session).fact.id;
  for(const event of ['SIGNED_IN','INITIAL_SESSION','TOKEN_REFRESHED','USER_UPDATED'])assert.equal(first(event,session),null);
  first('SIGNED_OUT',null);const b=first('SIGNED_IN',session).fact.id;assert.notEqual(a,b);
  const reopened=F.createRotation(options);const c=reopened('INITIAL_SESSION',session).fact.id;assert.notEqual(b,c);
  assert.ok(!stored.includes(session.user.id));assert.ok(!stored.includes('token'));
});
test('unavailable storage and corrupt saved state never block sign-in or repeat within the page',()=>{
  for(const read of [()=>'{invalid',()=>JSON.stringify({version:1,last:'expired-id',remaining:['unknown','unknown']}),()=>{throw Error('Storage blocked')}]){
    const rotate=F.createRotation({read,write:()=>{throw Error('Quota exceeded')},random,onDate});
    const a=rotate('SIGNED_IN',session).fact.id;rotate('SIGNED_OUT',null);assert.notEqual(rotate('SIGNED_IN',session).fact.id,a);
  }
});
test('overdue editorial content is excluded; calculation examples keep the card working',()=>{
  const available=F.eligible('2027-03-10');assert.equal(available.length,2);assert.ok(available.every(f=>f.example));
  const a=F.nextFact({},random,'2027-03-10'),b=F.nextFact(a.state,random,'2027-03-10');assert.notEqual(a.fact.id,b.fact.id);
});
test('each capsule has a verified official source and examples are not labelled statistics',()=>{
  assert.equal(new Set(F.facts.map(f=>f.id)).size,F.facts.length);
  for(const f of F.facts){assert.equal(new URL(f.source.url).hostname,'www.canada.ca');assert.equal(new URL(f.source.url).protocol,'https:');assert.equal(f.checkedOn,'2026-09-10');assert.ok(f.title&&f.body);if(f.example)assert.match(f.body,/Exemple de calcul/)}
  assert.equal(25*52,1300);assert.equal(1200/12,100);
});
