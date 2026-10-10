import importlib.util
from pathlib import Path
import unittest
import numpy as np
from datetime import datetime
spec=importlib.util.spec_from_file_location('raster',Path(__file__).parents[1]/'scripts/process_sundarbans.py')
r=importlib.util.module_from_spec(spec);spec.loader.exec_module(r)

class RasterScience(unittest.TestCase):
    def test_qa_rejects_cloud_water_shadow_fill(self):
        vi=np.array([[5000,5000,5000,5000,-3000,10001]],dtype=float)
        qa=np.array([[2048,2048|256,0,2048|32768,2048,2048]],dtype=float)
        np.testing.assert_array_equal(r.qa_mask(vi,qa),[[True,False,False,False,False,False]])
    def test_screened_policy_is_explicit_and_retains_only_checked_flags(self):
        vi=np.array([[5000,5000]],dtype=float);qa=np.array([[2185,2185|256]],dtype=float)
        np.testing.assert_array_equal(r.qa_mask(vi,qa),[[False,False]])
        np.testing.assert_array_equal(r.qa_mask(vi,qa,policy="screened"),[[True,False]])
    def test_equal_month_and_year_weights(self):
        records=[]
        for year in range(2001,2006):
            for month in r.MONTHS:
                records.append((datetime(year,month,1),np.array([[.4]])))
                if month==1:records.append((datetime(year,month,17),np.array([[.8]])))
        mean,count=r.seasonal_mean(records,[2001,2005],(1,1))
        self.assertAlmostEqual(mean[0,0],.45);self.assertEqual(count[0,0],5)
    def test_three_complete_years_required_no_gap_filling(self):
        records=[(datetime(y,m,1),np.array([[.5,.5]])) for y in [2001,2002] for m in r.MONTHS]
        mean,count=r.seasonal_mean(records,[2001,2005],(1,2))
        self.assertTrue(np.isnan(mean).all());self.assertEqual(count[0,0],2)
        records += [(datetime(2003,m,1),np.array([[.6,np.nan]])) for m in r.MONTHS]
        mean,count=r.seasonal_mean(records,[2001,2005],(1,2))
        self.assertAlmostEqual(mean[0,0],1.6/3);self.assertTrue(np.isnan(mean[0,1]))
    def test_transparent_missing_pixels_and_difference_direction(self):
        out=r.colors(np.array([[-.3,0,.3,np.nan]]),True)
        self.assertEqual(out[0,3,3],0);self.assertEqual(out[0,0,0],137);self.assertEqual(out[0,2,1],91)

if __name__=='__main__':unittest.main()
