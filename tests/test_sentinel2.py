"""Integration checks for the published measured Sentinel-2 grids."""
import unittest,json
from pathlib import Path
import numpy as np
import rasterio
ROOT=Path(__file__).resolve().parents[1]/'public/data/sentinel2'
class SentinelGrids(unittest.TestCase):
 def test_paired_science_and_coverage(self):
  m=json.loads((ROOT/'manifest.json').read_text())
  with rasterio.open(ROOT/'before.tif') as ds: b=ds.read(1);self.assertEqual(ds.crs.to_epsg(),32645);self.assertEqual(ds.res,(10,10))
  with rasterio.open(ROOT/'after.tif') as ds:a=ds.read(1)
  with rasterio.open(ROOT/'change.tif') as ds:c=ds.read(1)
  paired=(b!=-9999)&(a!=-9999)
  self.assertEqual(int(paired.sum()),m['pairedPixels'])
  np.testing.assert_allclose(c[paired],a[paired]-b[paired],atol=1e-6)
  self.assertTrue(np.all(c[~paired]==-9999))
  self.assertAlmostEqual(float(c[paired].mean()),m['meanChange'],places=4)
  for k in ['beforeCount','afterCount']:
   with rasterio.open(ROOT/f'{k}.tif') as ds: self.assertTrue(np.all(ds.read(1)[paired]>=2))
 def test_display_grid_matches_images(self):
  from PIL import Image
  m=json.loads((ROOT/'manifest.json').read_text())
  shape=(m['height'],m['width'])
  for k in ['before','after','change']:
   a=np.fromfile(ROOT/f'{k}.bin',dtype='<f4').reshape(shape)
   im=np.asarray(Image.open(ROOT/f'{k}-ndvi.png'))
   np.testing.assert_array_equal(np.isfinite(a),im[:,:,3]>0)
 def test_matching_season_and_collection(self):
  m=json.loads((ROOT/'manifest.json').read_text())
  for period,year in [('before','2020'),('after','2024')]:
   self.assertEqual(len(m['scenes'][period]),3)
   for scene in m['scenes'][period]:
    self.assertTrue(scene['date'].startswith(year+'-01-'))
    self.assertIn('/sentinel-2-c1-l2a/',scene['assets']['red']['href'])
    self.assertLess(scene['cloud'],10)
if __name__=='__main__':unittest.main()
