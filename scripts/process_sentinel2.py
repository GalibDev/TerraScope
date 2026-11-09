"""Build a bounded Sentinel-2 January comparison from public Earth Search COGs."""
import json, math, urllib.request, warnings
from pathlib import Path
from concurrent.futures import ThreadPoolExecutor
import numpy as np
import rasterio
from rasterio.warp import transform_bounds, reproject, Resampling, calculate_default_transform
from rasterio.transform import from_origin, array_bounds
from PIL import Image
ROOT=Path('.terrascope/sentinel2-c1'); ROOT.mkdir(parents=True,exist_ok=True)
OUT=Path('public/data/sentinel2'); OUT.mkdir(parents=True,exist_ok=True)
bbox=[89.72,21.90,89.84,22.00]
l,b,r,t=transform_bounds('EPSG:4326','EPSG:32645',*bbox)
l=math.floor(l/10)*10;t=math.ceil(t/10)*10
w=math.ceil((r-l)/10);h=math.ceil((t-b)/10);tr=from_origin(l,t,10,10)
profile=dict(driver='GTiff',width=w,height=h,count=1,dtype='float32',crs='EPSG:32645',transform=tr,nodata=-9999,compress='deflate')

def catalog(year):
 body=json.dumps(dict(collections=['sentinel-2-c1-l2a'],bbox=bbox,datetime=f'{year}-01-01T00:00:00Z/{year}-01-31T23:59:59Z',limit=100)).encode()
 req=urllib.request.Request('https://earth-search.aws.element84.com/v1/search',body,{'Content-Type':'application/json'})
 with urllib.request.urlopen(req,timeout=60) as res: items=json.load(res)['features']
 items=[i for i in items if i['properties'].get('eo:cloud_cover',100)<10 and i['properties'].get('grid:code')=='MGRS-45QYE']
 items=sorted(items,key=lambda i:(i['properties']['eo:cloud_cover'],i['id']))[:3]
 if len(items)!=3: raise ValueError('Need three scenes in each January')
 (ROOT/f'{year}-items.json').write_text(json.dumps(items,indent=2))
 return items

def read_asset(item,key):
 cache=ROOT/f"{item['id']}-{key}.npy"
 if cache.exists(): return np.load(cache)
 a=item['assets'][key]; target=np.full((h,w),np.nan,dtype='float32')
 with rasterio.Env(GDAL_DISABLE_READDIR_ON_OPEN='EMPTY_DIR',CPL_VSIL_CURL_ALLOWED_EXTENSIONS='.tif',GDAL_HTTP_TIMEOUT='120',GDAL_HTTP_MAX_RETRY='3'):
  with rasterio.open(a['href']) as src:
   reproject(rasterio.band(src,1),target,src_transform=src.transform,src_crs=src.crs,src_nodata=0,dst_transform=tr,dst_crs='EPSG:32645',dst_nodata=np.nan,resampling=Resampling.nearest)
 if key!='scl':
  band=a['raster:bands'][0]; target=target*band['scale']+band.get('offset',0)
 np.save(cache,target)
 print('Read',item['id'],key,flush=True)
 return target

def period(year):
 items=catalog(year); ndvis=[]; rgbs=[]
 for item in items:
  with ThreadPoolExecutor(max_workers=4) as pool: bands=dict(zip(['red','green','blue','nir','scl'],pool.map(lambda k:read_asset(item,k),['red','green','blue','nir','scl'])))
  scl=bands['scl']; clear=np.isin(scl,[4,5,6]); land=np.isin(scl,[4,5])
  red,nir=bands['red'],bands['nir']; denom=red+nir
  ndvi=np.divide(nir-red,denom,out=np.full_like(red,np.nan),where=(denom>0)&land&(red>=0)&(nir>=0))
  ndvi[(ndvi < -1)|(ndvi>1)]=np.nan
  ndvis.append(ndvi)
  rgbs.append(np.where(clear[...,None],np.stack([bands[k] for k in ['red','green','blue']],-1),np.nan))
 ns=np.stack(ndvis);rs=np.stack(rgbs)
 with warnings.catch_warnings():
  warnings.simplefilter('ignore',RuntimeWarning)
  ndvi=np.nanmedian(ns,axis=0);rgb=np.nanmedian(rs,axis=0)
 count=np.isfinite(ns).sum(axis=0); ndvi[count<2]=np.nan
 rgb[np.isfinite(rs).all(-1).sum(0)<2]=np.nan
 return items,ndvi,rgb,count

before,bn,br,bc=period(2020);after,an,ar,ac=period(2024)
paired=np.isfinite(bn)&np.isfinite(an); bn=np.where(paired,bn,np.nan);an=np.where(paired,an,np.nan);change=an-bn
# Display at a 10 m ground grid in Web Mercator; nearest neighbour preserves values.
dt,dw,dh=calculate_default_transform('EPSG:32645','EPSG:3857',w,h,*array_bounds(h,w,tr),resolution=10/math.cos(math.radians(21.95)))
def display(a):
 dst=np.full((dh,dw),np.nan,dtype='float32');reproject(a,dst,src_transform=tr,src_crs='EPSG:32645',src_nodata=np.nan,dst_transform=dt,dst_crs='EPSG:3857',dst_nodata=np.nan,resampling=Resampling.nearest);return dst
for key,arr in [('before',bn),('after',an),('change',change),('beforeCount',bc.astype('float32')),('afterCount',ac.astype('float32'))]:
 with rasterio.open(OUT/f'{key}.tif','w',**profile) as ds: ds.write(np.where(np.isfinite(arr),arr,-9999).astype('float32'),1)
 display(arr).astype('<f4').tofile(OUT/f'{key}.bin')
for key,rgb in [('before',br),('after',ar)]:
 d=np.stack([display(rgb[:,:,c]) for c in range(3)],-1);valid=np.isfinite(d).all(-1)
 rendered=(np.clip(np.nan_to_num(d)/.3,0,1)**(1/1.4)*255).astype('uint8')
 Image.fromarray(np.dstack([rendered,valid.astype('uint8')*255])).save(OUT/f'{key}-rgb.png')
for key,a in [('before',bn),('after',an),('change',change)]:
 d=display(a); stops=np.array([[137,83,57],[237,232,207],[40,91,71]] if key=='change' else [[190,171,123],[159,184,127],[40,91,71]])
 x=np.clip((d+.3)/.6 if key=='change' else (d+.2)/1.2,0,1);safe=np.nan_to_num(x)
 color=np.stack([np.interp(safe,[0,.5,1],stops[:,c]) for c in range(3)],-1).astype('uint8')
 Image.fromarray(np.dstack([color,np.isfinite(d).astype('uint8')*255])).save(OUT/f'{key}-ndvi.png')
left,bottom,right,top=array_bounds(dh,dw,dt)
from rasterio.warp import transform
xs,ys=transform('EPSG:3857','EPSG:4326',[left,right,right,left],[top,top,bottom,bottom])
manifest=dict(status='available',width=dw,height=dh,bounds=[left,bottom,right,top],coordinates=list(map(list,zip(xs,ys))),bbox=bbox,before='January 2020',after='January 2024',pairedPixels=int(paired.sum()),nativePixels=int(paired.size),pairedCoveragePercent=round(100*paired.mean(),1),meanChange=round(float(np.nanmean(change)),4),source='Copernicus Sentinel-2 Collection-1 L2A via Element 84 Earth Search public COGs',method='Three lowest scene-cloud January scenes per period; per-pixel SCL 4/5 for NDVI, 4/5/6 for RGB; >=2 clear observations per period; median of per-scene NDVI; paired land pixels only. SCL native 20 m nearest-resampled to 10 m; reflectance scale/offset read from each STAC asset. Same RGB stretch both periods: 0–0.3, gamma 1.4. Descriptive change, not forest loss or significance.',scenes={k:[dict(id=i['id'],date=i['properties']['datetime'],cloud=i['properties']['eo:cloud_cover'],assets={a:i['assets'][a] for a in ['red','green','blue','nir','scl']}) for i in v] for k,v in [('before',before),('after',after)]})
(OUT/'manifest.json').write_text(json.dumps(manifest,indent=2));print(json.dumps({k:v for k,v in manifest.items() if k not in ['scenes','coordinates']},indent=2))


