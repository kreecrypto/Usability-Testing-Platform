import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

const inventory=readFileSync('docs/screen-inventory.md','utf8');
const expected=[...inventory.matchAll(/^\| ([SP]\d{2}) \|/gm)].map(m=>m[1]);
const screens=JSON.parse(readFileSync('public/wireframes/coverage.json','utf8'));
const html=readFileSync('public/wireframes/index.html','utf8');
assert.equal(expected.length,48,'Authoritative inventory must still contain 48 screens');
assert.deepEqual(screens.map(s=>s.id).sort(),expected.sort(),'Cover every inventory screen exactly once');
assert(screens.every(s=>s.flow&&s.action&&s.note&&s.states.length),'Every screen needs flow, primary action, notes and states');
assert(screens.every(s=>expected.includes(s.target)),'All primary destinations exist');
const script=html.match(/<script>([\s\S]*?)<\/script>/)[1];
new vm.Script(script);
assert(!/<(?:script|link|iframe|img)[^>]+(?:src|href)=['"]https?:/i.test(html),'Review artifact must not load external resources');
assert(!/\b(?:fetch|XMLHttpRequest|WebSocket)\s*\(/.test(script),'Wireframe must not send user data');
const css=html.match(/<style>([\s\S]*?)<\/style>/)[1];
for(const [,hex] of css.matchAll(/#([\da-f]{3,6})\b/gi)){
  const expanded=hex.length===3?[...hex].map(v=>v+v).join(''):hex;
  assert(expanded.slice(0,2)===expanded.slice(2,4)&&expanded.slice(2,4)===expanded.slice(4,6),`Non-grayscale color: #${hex}`);
}
assert(css.includes(':focus-visible'),'Keyboard focus must be represented');
assert(css.includes('@media(max-width:640px)'),'Mobile layout required');
assert.equal((17/22*100).toFixed(1),'77.3');
assert.equal((21/25*100-17/22*100).toFixed(1),'6.7');
console.log(`PASS: ${screens.length} inventory screens, ${screens.reduce((n,s)=>n+s.states.length,0)} states, valid script, grayscale, local-only artifact, versioned fixture arithmetic.`);
