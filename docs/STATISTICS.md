# Trend uncertainty and evidence categories

Inputs are quality-filtered NDVI/EVI observations for one registered location. Monthly means have equal weight when computing annual means; a month with two valid composites is not twice as influential as a month with one. A year contributes only when all 12 months have observations. There is no interpolation. Descriptive OLS slope requires at least five complete years; the time regressor is actual calendar year, not an observation index.

Uncertainty is offered only with **at least 20 complete, consecutive years**, nondegenerate residual variance and a finite positive covariance estimate. Gaps are not compressed into adjacent observations. This minimum is an application guardrail, not a mathematical guarantee of valid inference.

The slope covariance uses the Newey–West heteroskedasticity/autocorrelation consistent sandwich estimator, Bartlett weights, lag `floor(4*(n/100)^(2/9))`, and finite-sample factor `n/(n−2)`. With a centered time regressor `x`, residual `e`, score `s=x*e`, `Sxx=sum(x²)`, the slope variance is:

```text
[sum(s_t²) + 2*sum_lag((1-lag/(L+1))*sum_t(s_t*s_(t-lag)))] / Sxx² * n/(n-2)
```

The reported interval is **approximate 95%**, `slope ± 1.959963984540054*SE`, using an asymptotic normal reference. It is not an exact small-sample interval. Tests compare the implementation to an independently calculated NumPy matrix sandwich fixture; that fixture is labeled synthetic and is never shipped as scientific measurements.

Decision rules:

| Category                   | Rule                                                                          |
| -------------------------- | ----------------------------------------------------------------------------- |
| Greening                   | Eligible interval entirely above zero                                         |
| Browning                   | Eligible interval entirely below zero                                         |
| No clear directional trend | Eligible interval includes zero                                               |
| Insufficient data          | Too few complete years, a gap, degenerate residuals or unavailable covariance |

Greening/browning describes index direction under the model. It does not establish deforestation, recovery or cause. HAC addresses short-range residual dependence; it does not solve nonstationarity, structural breaks, long-memory dependence, spatial bias, varying land use or observation selection. Intervals are exploratory and **not adjusted for multiple comparisons**. The displayed summary counts selected locations, not hectares or land percentage. Synthetic mode performs the same calculations only to demonstrate the interface and cannot support a scientific conclusion.

Anomaly exploration uses calendar-month values from a fixed 2001–2010 baseline, with ≥5 valid values and nonzero sample SD per month. `z=(value-baseline_mean)/baseline_SD`, and `|z|≥2` flags an unusual observation descriptively. Baseline-period observations also appear in the baseline if displayed; this is not leave-one-out testing. Secular trends and changing coverage affect the scores. No disaster attribution or calibrated p-value is claimed.

References: [statsmodels HAC documentation](https://www.statsmodels.org/stable/generated/statsmodels.stats.sandwich_covariance.cov_hac.html), [reference source implementation](https://github.com/statsmodels/statsmodels/blob/main/statsmodels/stats/sandwich_covariance.py). This implementation follows the documented consecutive/equally spaced requirement and kernel/correction choices; statsmodels is not an application dependency.
