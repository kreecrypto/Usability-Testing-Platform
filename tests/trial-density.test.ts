import assert from 'node:assert/strict';
import test from 'node:test';
import {calculateDensity,densityPixels,densitySteps,DENSITY_MAX_PIXELS} from '../src/lib/trial/density.ts';
import {SIMULATION_LAYOUT,type BehaviorEvent} from '../src/lib/trial/behavior.ts';
const point=(change:Partial<BehaviorEvent>={}):BehaviorEvent=>({id:'a',sessionId:'s',versionId:'v',taskId:'t',sequence:1,at:'2026-10-10T00:00:00Z',type:'pointer',screenId:'houses',layoutVersion:SIMULATION_LAYOUT,viewportWidth:320,viewportHeight:600,documentWidth:320,documentHeight:1400,documentX:80.5,documentY:1036.5,...change});
test('source-space kernel uses exact scrolled coordinates, radius32 and transparent zero',()=>{
 const f=calculateDensity([point()])!;assert.equal(f.values[1036*f.width+80],1);assert.equal(f.values[1036*f.width+96],.5);assert.equal(f.values[1036*f.width+112],0);assert.equal(f.values[400*f.width+80],0);
 const pixels=densityPixels(f);assert.equal(pixels[(1036*f.width+80)*4+3],190);assert.equal(pixels[3],0);
});
test('distinct overlapping events add; duplicate IDs count once; input order cannot change field',()=>{
 const a=point(),b=point({id:'b',sequence:2,sessionId:'s2'});const f=calculateDensity([b,a,a])!,one=calculateDensity([a])!;
 assert.equal(f.peak,2*one.peak);assert.deepEqual(f.eventIds,['a','b']);assert.equal(f.sessionCount,2);assert.deepEqual(f,calculateDensity([a,b]));assert.deepEqual(a,point());
 assert.throws(()=>calculateDensity([a,{...a,documentX:90}]),/Conflicting/);
});
test('non-pointer and invalid coordinates produce no fabricated density',()=>{
 assert.equal(calculateDensity([]),null);assert.equal(calculateDensity([point({type:'action',documentX:undefined,documentY:undefined}),point({documentX:-1}),point({documentY:Infinity})]),null);
});
test('mixed versions and each geometry dimension are rejected',()=>{
 const a=point();for(const change of [{versionId:'other'},{screenId:'dashboard' as const},{viewportWidth:390},{viewportHeight:601},{documentWidth:321},{documentHeight:1401}])assert.throws(()=>calculateDensity([a,point({id:'b',...change})]),/Mixed/);
});
test('clipped edge kernels retain source locations and never wrap rows',()=>{
 const f=calculateDensity([point({documentX:0,documentY:0})])!;assert.ok(f.values[0]>0);assert.equal(f.values[f.width-1],0);assert.equal(f.values[f.values.length-1],0);
 const end=calculateDensity([point({documentX:320,documentY:1400})])!;assert.ok(end.values[end.values.length-1]>0);assert.equal(end.values[0],0);
});
test('maximum and extreme-aspect document raster stays bounded with original-space radius',()=>{
 for(const [w,h] of [[20000,20000],[20000,1],[1,20000],[12345,6789]]){
 const f=calculateDensity([point({documentWidth:w,documentHeight:h,documentX:w/2,documentY:h/2})])!;
 assert.ok(f.width*f.height<=DENSITY_MAX_PIXELS);assert.equal(f.documentWidth,w);assert.equal(f.documentHeight,h);assert.ok(f.peak>0);assert.ok(Math.abs(f.width/w-f.height/h)<=1/Math.min(w,h));
 }
});
test('incremental calculation can be cancelled without publishing a partial field',()=>{
 const steps=densitySteps(Array.from({length:30},(_,i)=>point({id:String(i),sequence:i+1})));assert.equal(steps.next().done,false);assert.equal(steps.return(null).value,null);assert.equal(steps.next().done,true);
});
