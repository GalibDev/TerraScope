import 'server-only';
import {z} from 'zod';
const base='https://appeears.earthdatacloud.nasa.gov/api';
export async function nasaFetch(url:string,init:RequestInit={}){const r=await fetch(url,{...init,signal:AbortSignal.timeout(20000)});if(!r.ok)throw new Error(`Provider returned HTTP ${r.status}`);return r;}
export async function appeearsToken(){const u=process.env.NASA_EARTHDATA_USERNAME,p=process.env.NASA_EARTHDATA_PASSWORD;if(!u||!p)throw new Error('Earthdata setup required');const r=await nasaFetch(`${base}/login`,{method:'POST',headers:{Authorization:`Basic ${Buffer.from(`${u}:${p}`).toString('base64')}`},cache:'no-store'});return z.object({token:z.string(),expiration:z.string()}).parse(await r.json()).token;}
export async function product(){return (await nasaFetch(`${base}/product/MOD13Q1.061`,{next:{revalidate:86400}})).json();}
export async function submitPoint(token:string,longitude:number,latitude:number,start:string,end:string){
 const meta=await product();const layers=['_250m_16_days_NDVI','_250m_16_days_EVI','_250m_16_days_VI_Quality'];for(const layer of layers)if(!meta[layer]?.Available)throw new Error('Required MODIS layer unavailable');
 return (await nasaFetch(`${base}/task`,{method:'POST',headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json'},body:JSON.stringify({task_type:'point',task_name:'TerraScope study point',params:{dates:[{startDate:start,endDate:end}],layers:layers.map(layer=>({product:'MOD13Q1.061',layer})),coordinates:[{id:'study',longitude,latitude}]}})})).json();
}
export async function taskStatus(token:string,id:string){if(!/^[a-zA-Z0-9-]{1,80}$/.test(id))throw new Error('Invalid task ID');return (await nasaFetch(`${base}/task/${id}`,{headers:{Authorization:`Bearer ${token}`},cache:'no-store'})).json();}
export async function bundle(token:string,id:string){if(!/^[a-zA-Z0-9-]{1,80}$/.test(id))throw new Error('Invalid task ID');return (await nasaFetch(`${base}/bundle/${id}`,{headers:{Authorization:`Bearer ${token}`},cache:'no-store'})).json();}
