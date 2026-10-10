"""Quality-filtered seasonal MODIS comparison, native-grid calculations then display reprojection."""
import argparse, calendar, hashlib, json, re
from datetime import datetime, timezone
from pathlib import Path
import numpy as np
import rasterio
from rasterio.warp import calculate_default_transform, reproject, transform, Resampling
from PIL import Image

MONTHS = (1, 2, 11, 12)

def qa_mask(vi, qa, nodata=None, policy="strict"):
    valid = np.isfinite(vi) & np.isfinite(qa) & (vi >= -2000) & (vi <= 10000)
    if nodata is not None:
        valid &= vi != nodata
    q = np.where(np.isfinite(qa), qa, 65535).astype(np.uint16)
    return valid & ((q & 3) <= (0 if policy=="strict" else 1)) & (((q >> 2) & 15) <= 2) & (((q >> 6) & 3) <= (1 if policy=="strict" else 2)) & ((q & ((1 << 8) | (1 << 10) | (1 << 14) | (1 << 15))) == 0) & (((q >> 11) & 7) == 1)

def seasonal_mean(records, years, shape):
    # Equal weights for months and years; no interpolation or missing-month substitution.
    annual = []
    for year in range(years[0], years[1]+1):
        monthly = []
        for month in MONTHS:
            values = [v for d,v in records if d.year == year and d.month == month]
            if values:
                stack = np.stack(values)
                count = np.isfinite(stack).sum(axis=0)
                monthly.append(np.divide(np.nansum(stack, axis=0), count, out=np.full(shape,np.nan), where=count>0))
            else:
                monthly.append(np.full(shape,np.nan))
        stack = np.stack(monthly)
        annual.append(np.where(np.isfinite(stack).all(axis=0), np.mean(stack,axis=0), np.nan))
    stack = np.stack(annual)
    count = np.isfinite(stack).sum(axis=0)
    mean = np.divide(np.nansum(stack,axis=0), count, out=np.full(shape,np.nan), where=count>=3)
    return mean, count

def colors(values, change=False):
    stops = np.array([[137,83,57],[237,232,207],[40,91,71]] if change else [[190,171,123],[159,184,127],[40,91,71]],dtype=float)
    x = np.clip((values+0.3)/0.6 if change else (values+0.2)/1.2,0,1)
    safe = np.nan_to_num(x)
    rgb=np.stack([np.interp(safe,[0,.5,1],stops[:,i]) for i in range(3)],axis=-1)
    return np.dstack([rgb,np.where(np.isfinite(values),235,0)]).astype(np.uint8)

def main():
    ap=argparse.ArgumentParser();ap.add_argument('--root',default='.terrascope/sundarbans');ap.add_argument('--out',default='public/data/sundarbans');ap.add_argument('--qa-policy',choices=['strict','screened'],default='strict');args=ap.parse_args()
    root=Path(args.root); out=Path(args.out); config=json.loads(Path('data/studies/sundarbans.json').read_text(encoding='utf-8-sig'))
    tasks=json.loads((root/'tasks.json').read_text()); ref=None; results={}; strict_results={}; digests={}
    for period,years in config['periods'].items():
        records=[]; strict_records=[]; ndvis=sorted((root/period).glob('*_NDVI_*.tif'))
        if not ndvis: raise ValueError(f'No downloaded NDVI rasters for {period}')
        for path in ndvis:
            qa_path=path.with_name(path.name.replace('_NDVI_','_VI_Quality_'))
            if not qa_path.exists(): raise ValueError(f'Missing paired QA: {path.name}')
            m=re.search(r'_(\d{8})T',path.name)
            if not m: raise ValueError('Expected provider calendar-date filenames')
            date=datetime.strptime(m[1],'%Y%m%d')
            if date.year not in range(years[0],years[1]+1) or date.month not in MONTHS: continue
            with rasterio.open(path) as src,rasterio.open(qa_path) as qa:
                if src.count!=1 or qa.count!=1: raise ValueError('Expected single-band rasters')
                if src.crs is None or src.crs!=qa.crs or src.transform!=qa.transform or src.shape!=qa.shape: raise ValueError('VI/QA grids differ')
                if ref is None: ref=src.profile.copy()
                if src.crs!=ref['crs'] or src.transform!=ref['transform'] or src.shape!=(ref['height'],ref['width']): raise ValueError('Temporal grids differ; do not silently resample QA')
                # MOD13Q1 native GeoTIFF integer values; fail rather than double-scale an unexpected export.
                if not np.issubdtype(np.dtype(src.dtypes[0]),np.integer): raise ValueError('Expected raw integer MODIS NDVI, inspect scaling before processing')
                if src.scales[0] not in (1, .0001) or src.offsets[0] != 0: raise ValueError('Unexpected NDVI scale/offset metadata')
                if src.crs.to_dict().get('proj') != 'sinu': raise ValueError('Expected native MODIS sinusoidal equal-area grid')
                vi=src.read(1).astype(float); quality=qa.read(1).astype(float)
                values=np.where(qa_mask(vi,quality,src.nodata,args.qa_policy),vi*.0001,np.nan)
                records.append((date,values))
                strict_records.append((date,np.where(qa_mask(vi,quality,src.nodata,"strict"),vi*.0001,np.nan)))
            digests[path.name]=hashlib.sha256(path.read_bytes()).hexdigest();digests[qa_path.name]=hashlib.sha256(qa_path.read_bytes()).hexdigest()
        if len({d for d,_ in records})!=len(records): raise ValueError('Duplicate composite dates')
        results[period]=seasonal_mean(records,years,(ref['height'],ref['width']))
        strict_results[period]=seasonal_mean(strict_records,years,(ref['height'],ref['width']))
    before,bc=results['before'];after,ac=results['after']; common=np.isfinite(before)&np.isfinite(after)
    before=np.where(common,before,np.nan);after=np.where(common,after,np.nan);change=after-before
    if not common.any(): raise ValueError('No pixels have sufficient paired seasonal coverage; no measured comparison published')
    out.mkdir(parents=True,exist_ok=True)
    # Native equal-area grid supports the paired pixel summary. Display grid uses nearest-neighbour only.
    native_bounds=rasterio.transform.array_bounds(ref['height'],ref['width'],ref['transform'])
    dst_transform,w,h=calculate_default_transform(ref['crs'],'EPSG:3857',ref['width'],ref['height'],*native_bounds,resolution=250)
    if w*h>1_000_000: raise ValueError('Display grid unexpectedly large')
    display={}
    for name,values in [('before',before),('after',after),('change',change)]:
        dst=np.full((h,w),np.nan,dtype=np.float32)
        reproject(values.astype(np.float32),dst,src_transform=ref['transform'],src_crs=ref['crs'],dst_transform=dst_transform,dst_crs='EPSG:3857',src_nodata=np.nan,dst_nodata=np.nan,resampling=Resampling.nearest)
        display[name]=dst;Image.fromarray(colors(dst,name=='change')).save(out/f'{name}.png')
        with rasterio.open(out/f'{name}.tif','w',driver='GTiff',height=ref['height'],width=ref['width'],count=1,dtype='float32',crs=ref['crs'],transform=ref['transform'],nodata=-9999,compress='deflate') as dstfile: dstfile.write(np.where(np.isfinite(values),values,-9999).astype('float32'),1)
    for name,counts in [('beforeYears',bc),('afterYears',ac)]:
        dst=np.zeros((h,w),dtype=np.float32)
        reproject(counts.astype(np.float32),dst,src_transform=ref['transform'],src_crs=ref['crs'],dst_transform=dst_transform,dst_crs='EPSG:3857',src_nodata=0,dst_nodata=0,resampling=Resampling.nearest)
        display[name]=dst
    left,bottom,right,top=rasterio.transform.array_bounds(h,w,dst_transform)
    xs,ys=transform('EPSG:3857','EPSG:4326',[left,right,right,left],[top,top,bottom,bottom])
    manifest={'status':'available','study':config,'retrievedAt':datetime.now(timezone.utc).isoformat(),'tasks':tasks,'coordinates':list(map(list,zip(xs,ys))),'displayBounds':[left,bottom,right,top],'width':w,'height':h,'images':{k:f'/data/sundarbans/{k}.png' for k in ['before','after','change']},'grid':{k:np.where(np.isfinite(v),np.round(v,4),None).tolist() for k,v in display.items()},'qaPolicy':args.qa_policy,'strictPairedPixels':int((np.isfinite(strict_results['before'][0]) & np.isfinite(strict_results['after'][0])).sum()),'summary':{'pairedPixels':int(common.sum()),'nativePixels':int(common.size),'pairedCoveragePercent':round(float(common.mean()*100),1),'meanChange':round(float(np.nanmean(change)),4)},'method':('Strict DetailedQA' if args.qa_policy=='strict' else 'Exploratory screened DetailedQA: MODLAND 0/1 with usefulness <=2 and aerosol <=2; moderate aerosol included; clouds/snow/shadow excluded')+' and land mask; raw NDVI × 0.0001; equal-month means for Jan/Feb/Nov/Dec; all four months required per year; at least 3 complete seasonal years per period; paired pixels only. Nearest-neighbour reprojection for display. Difference is descriptive, not significance or forest-loss attribution.','sourceChecksums':digests}
    (out/'manifest.json').write_text(json.dumps(manifest,allow_nan=False,separators=(',',':')))
    print(json.dumps(manifest['summary']))

if __name__=='__main__':main()
