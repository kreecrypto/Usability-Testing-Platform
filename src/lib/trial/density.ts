import { geometryKey, validBehavior, type BehaviorEvent } from './behavior.ts';
export const DENSITY_RADIUS = 32;
export const DENSITY_MAX_PIXELS = 1_000_000;
export type DensityField = { width:number; height:number; documentWidth:number; documentHeight:number; values:Float64Array; peak:number; eventIds:string[]; sessionCount:number };
/** Linear radial weights in original document coordinates; stable ID order makes addition reproducible. */
export function* densitySteps(input:BehaviorEvent[]):Generator<void,DensityField|null> {
  const events=new Map<string,BehaviorEvent>();
  for(const e of input) {
    if(e.type!=='pointer' || !validBehavior(e)) continue;
    const prior=events.get(e.id);
    if(prior && JSON.stringify(prior)!==JSON.stringify(e)) throw new Error('Conflicting event ID');
    events.set(e.id,e);
  }
  const points=[...events.values()].sort((a,b)=>a.id<b.id?-1:a.id>b.id?1:0);
  if(!points.length)return null;
  const first=points[0];
  if(points.some(e=>e.versionId!==first.versionId || geometryKey(e)!==geometryKey(first))) throw new Error('Mixed version or geometry');
  const {documentWidth,documentHeight}=first;
  const reduction=Math.min(1,Math.sqrt(DENSITY_MAX_PIXELS/(documentWidth*documentHeight)));
  const width=Math.max(1,Math.floor(documentWidth*reduction));
  const height=Math.max(1,Math.min(Math.floor(DENSITY_MAX_PIXELS/width),Math.floor(documentHeight*reduction)));
  const sx=width/documentWidth,sy=height/documentHeight;
  const values=new Float64Array(width*height);
  let work=0,peak=0;
  for(const e of points) {
    const px=e.documentX!,py=e.documentY!;
    const left=Math.max(0,Math.floor((px-DENSITY_RADIUS)*sx)),right=Math.min(width-1,Math.ceil((px+DENSITY_RADIUS)*sx));
    const top=Math.max(0,Math.floor((py-DENSITY_RADIUS)*sy)),bottom=Math.min(height-1,Math.ceil((py+DENSITY_RADIUS)*sy));
    for(let y=top;y<=bottom;y++)for(let x=left;x<=right;x++) {
      const weight=Math.max(0,1-Math.hypot((x+.5)/sx-px,(y+.5)/sy-py)/DENSITY_RADIUS);
      const at=y*width+x;
      values[at]+=weight;peak=Math.max(peak,values[at]);
      if(++work%16384===0)yield;
    }
  }
  return {width,height,documentWidth,documentHeight,values,peak,eventIds:points.map(e=>e.id),sessionCount:new Set(points.map(e=>e.sessionId)).size};
}
export function calculateDensity(points:BehaviorEvent[]):DensityField|null {
  const steps=densitySteps(points);let next=steps.next();while(!next.done)next=steps.next();return next.value;
}
/** Transparent zero; blue→cyan→yellow→red relative to this field's maximum only. */
export function densityPixels(field:DensityField):Uint8ClampedArray {
  const pixels=new Uint8ClampedArray(field.values.length*4);
  const stops=[[37,99,235],[6,182,212],[250,204,21],[220,38,38]];
  field.values.forEach((value,i)=>{
    if(value<=0 || field.peak<=0)return;
    const n=Math.min(1,value/field.peak),position=n*3,lo=Math.min(2,Math.floor(position)),mix=position-lo;
    for(let c=0;c<3;c++)pixels[i*4+c]=Math.round(stops[lo][c]*(1-mix)+stops[lo+1][c]*mix);
    pixels[i*4+3]=Math.round(190*Math.min(1,n*3));
  });return pixels;
}
