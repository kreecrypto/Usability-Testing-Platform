import assert from 'node:assert/strict';
import test from 'node:test';
import {createRequire} from 'node:module';
import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import * as React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {transformSync} from 'next/dist/build/swc/index.js';
const require=createRequire(import.meta.url);
// Compile actual TSX with the repository's existing Next SWC; no app test route.
function component(name:string) {
  const filename=resolve(`src/components/ui/${name}.tsx`);
  const {code}=transformSync(readFileSync(filename,'utf8'),{filename,jsc:{parser:{syntax:'typescript',tsx:true},transform:{react:{runtime:'automatic'}}},module:{type:'commonjs'}});
  const module={exports:{} as any};
  const imports=(id:string)=>require(id==='@/lib/ui'?resolve('src/lib/ui.ts'):id);
  new Function('require','module','exports',code)(imports,module,module.exports);
  return module.exports;
}
const {Button}=component('button');
const {Input}=component('input');
const {Card}=component('card');
const html=(props:any,child?:React.ReactNode)=>renderToStaticMarkup(React.createElement(Button,props,child));
test('Button preserves native submit default, explicit type, form attributes and refs',()=>{
  const ref=React.createRef<HTMLButtonElement>();
  const element=Button.render({name:'submit',form:'research',children:'บันทึก'},ref);
  assert.equal(element.props.type,undefined);assert.equal(element.props.form,'research');assert.equal(element.props.ref,ref);
  assert.match(html({type:'reset',name:'clear'},'ล้าง'),/type="reset"/);
});
test('disabled/loading Slot anchors cannot navigate or activate child handlers',()=>{
  for(const state of [{disabled:true},{loading:true}]) {
    let invoked=0;const child=React.createElement('a',{href:'#destination',tabIndex:0,'aria-disabled':false,onClick:()=>invoked++},'ไปต่อ');
    const text=html({...state,asChild:true},child);
    assert.doesNotMatch(text,/href=/);assert.match(text,/aria-disabled="true"/);assert.match(text,/tabindex="-1"/);
    const clone=Button.render({...state,asChild:true,children:child},null).props.children;
    for(const key of ['onClick','onClickCapture','onKeyDown']) {
      let prevented=0,stopped=0;clone.props[key]({key:'Enter',preventDefault:()=>prevented++,stopPropagation:()=>stopped++});
      assert.equal(prevented,1);assert.equal(stopped,1);
    }
    assert.equal(invoked,0);
  }
});
test('Slot child disabled=false cannot override loading; enabled links retain their destination',()=>{
  assert.match(html({asChild:true,loading:true},React.createElement('button',{disabled:false},'บันทึก')),/disabled=""/);
  assert.match(html({asChild:true},React.createElement('a',{href:'#destination'},'ไปต่อ')),/href="#destination"/);
  assert.match(html({loading:true},'บันทึก'),/aria-busy="true"/);
});
test('Input preserves checkbox/file semantics, constraints, event handler and ref',()=>{
  const ref=React.createRef<HTMLInputElement>(),change=()=>{};
  const e=Input.render({appearance:'legacy',type:'checkbox',checked:true,name:'consent',onChange:change,required:true},ref);
  assert.equal(e.props.type,'checkbox');assert.equal(e.props.checked,true);assert.equal(e.props.name,'consent');assert.equal(e.props.onChange,change);assert.equal(e.props.ref,ref);
  const file=Input.render({type:'file',accept:'.json'},null);assert.equal(file.props.type,'file');assert.equal(file.props.accept,'.json');
});
test('Card Slot keeps section/article semantics and legacy class without extra DOM',()=>{
  const text=renderToStaticMarkup(React.createElement(Card,{asChild:true,appearance:'legacy'},React.createElement('section',{className:'existing', 'aria-label':'หลักฐาน'},'ผล')));
  assert.match(text,/^<section/);assert.match(text,/class="existing"/);assert.doesNotMatch(text,/<div/);
});

test('inactive Slot blocks activation keys without trapping Tab, Escape or arrows',()=>{
  const child=React.createElement('a',{href:'#destination'},'ไปต่อ');
  const clone=Button.render({asChild:true,disabled:true,children:child},null).props.children;
  for(const key of ['Tab','Escape','ArrowDown']) {
    let prevented=false;clone.props.onKeyDown({key,preventDefault:()=>{prevented=true;},stopPropagation:()=>{}});
    assert.equal(prevented,false);
  }
});
