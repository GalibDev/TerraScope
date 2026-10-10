import {z} from 'zod';
export const rawSchema=z.object({date:z.iso.date(),value:z.number().finite(),qa:z.number().int().min(0).max(65535)});
export type Observation={date:string;value:number};
export function prepare(input:unknown[],scaled=false):Observation[]{
 const seen=new Set<string>();const out:Observation[]=[];
 for(const item of input){const parsed=rawSchema.safeParse(item);if(!parsed.success)continue;const r=parsed.data;
 // Strict DetailedQA: good MODLAND, highest usefulness, low/average aerosol, no adjacent/mixed cloud, snow or shadow.
 if((r.qa&3)!==0||((r.qa>>2)&15)>2||((r.qa>>6)&3)>1||(r.qa&((1<<8)|(1<<10)|(1<<14)|(1<<15))))continue;
 if(r.value===-3000)continue;const value=scaled?r.value:r.value*0.0001;
 if(value<-.2||value>1||seen.has(r.date))continue;seen.add(r.date);out.push({date:r.date,value});}
 return out.sort((a,b)=>a.date.localeCompare(b.date));
}
export function monthly(rows:Observation[]){const groups=new Map<string,number[]>();for(const r of rows){const k=r.date.slice(0,7);groups.set(k,[...(groups.get(k)||[]),r.value]);}return [...groups].map(([date,v])=>({date,value:v.reduce((a,b)=>a+b,0)/v.length,count:v.length}));}
export function trend(rows:Observation[]){
 const annual=new Map<string,Observation[]>();for(const r of rows)annual.set(r.date.slice(0,4),[...(annual.get(r.date.slice(0,4))||[]),r]);
 const complete=[...annual].filter(([,r])=>new Set(r.map(x=>x.date.slice(5,7))).size===12).map(([year,r])=>({x:+year,y:r.reduce((s,x)=>s+x.value,0)/r.length}));
 const n=complete.length;if(n<5)return {slope:null,classification:'Insufficient data',n,interval:null};
 const mx=complete.reduce((s,r)=>s+r.x,0)/n,my=complete.reduce((s,r)=>s+r.y,0)/n;
 const xx=complete.reduce((s,r)=>s+(r.x-mx)**2,0),slope=complete.reduce((s,r)=>s+(r.x-mx)*(r.y-my),0)/xx;
 // Descriptive OLS only: temporal dependence not established; no unsupported significance label.
 return {slope,classification:'No clear directional trend',n,interval:null};
}
export function seasonal(rows:Observation[]){return Array.from({length:12},(_,i)=>{const v=rows.filter(r=>+r.date.slice(5,7)===i+1);return {month:new Date(2000,i).toLocaleString('en',{month:'short'}),value:v.length?v.reduce((s,r)=>s+r.value,0)/v.length:null};});}
export function anomalies(rows:Observation[],start=2001,end=2010){return rows.map(r=>{const b=rows.filter(x=>+x.date.slice(0,4)>=start&&+x.date.slice(0,4)<=end&&x.date.slice(5,7)===r.date.slice(5,7));const mean=b.reduce((s,x)=>s+x.value,0)/b.length;const sd=Math.sqrt(b.reduce((s,x)=>s+(x.value-mean)**2,0)/(b.length-1));return {...r,z:b.length>=5&&sd>0?(r.value-mean)/sd:null};});}
export function demo(region=0,index='NDVI'):Observation[]{return Array.from({length:24*12},(_,i)=>({date:`${2001+Math.floor(i/12)}-${String(i%12+1).padStart(2,'0')}-01`,value:Math.max(-.2,Math.min(1,(region===3?.16:.52-region*.035)+.13*Math.sin((i%12-3)*Math.PI/6)+i*(region===3?-.00005:.00016)+.018*Math.sin(i*1.7)))*(index==='EVI'?.78:1)}));}
