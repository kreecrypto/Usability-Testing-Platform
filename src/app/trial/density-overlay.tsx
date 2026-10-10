'use client';
import { useEffect, useRef, useState } from 'react';
import { densityPixels, densitySteps } from '../../lib/trial/density';
import type { BehaviorEvent } from '../../lib/trial/behavior';
export default function DensityOverlay({points,onFailure}:{points:BehaviorEvent[];onFailure:()=>void}) {
  const canvas=useRef<HTMLCanvasElement>(null);
  const [ready,setReady]=useState(false);
  useEffect(()=>{
    let cancelled=false,timer:ReturnType<typeof setTimeout>;
    const steps=densitySteps(points);
    const render=()=>{
      if(cancelled)return;
      try {
        const next=steps.next();
        if(!next.done){timer=setTimeout(render,0);return;}
        const field=next.value,node=canvas.current;
        if(!field || !node)throw new Error('No density field');
        node.width=field.width;node.height=field.height;
        const context=node.getContext('2d');if(!context)throw new Error('Canvas unavailable');
        const image=context.createImageData(field.width,field.height);image.data.set(densityPixels(field));context.putImageData(image,0,0);
        if(!cancelled)setReady(true);
      } catch {if(!cancelled)onFailure();}
    };
    timer=setTimeout(render,0);
    return()=>{cancelled=true;clearTimeout(timer);steps.return(null);};
  },[points,onFailure]);
  return <>{!ready && <span role="status" style={{position:'absolute',inset:0}}>กำลังวาดสีความหนาแน่น…</span>}<canvas ref={canvas} aria-hidden="true" data-density-state={ready?'ready':'loading'} style={{position:'absolute',left:0,top:0,width:points[0].documentWidth,height:points[0].documentHeight,pointerEvents:'none',visibility:ready?'visible':'hidden'}} /></>;
}
