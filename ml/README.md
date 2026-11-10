# Audit-X ML & Demand Forecasting (`ml/`)

This module defines demand forecasting specifications for `audit-x-blinkit` dark stores (`TIPTUR-HUB-KA44`, `TUMKUR-HUB-KA06`, `ARSIKERE-HUB-KA13`).

- **Primary Model**: Seasonal Time-Series Decomposition (`Prophet-v1.3`) blended with gradient-boosted lag features.
- **Granularity**: SKU × Darkstore × Daily horizon (10 days historical validation + 4-day forward prediction in `Demand_Forecast`).
- **Safety Stock & Reorder Point Formula**:
  $$\text{ROP} = (\bar{d} \times L) + z \cdot \sigma_d \sqrt{L}$$
  where $\bar{d}$ is average daily SKU demand, $L$ is replenishment lead time in days, and $z \cdot \sigma_d \sqrt{L}$ provides 95% service-level safety buffer ($z = 1.65$).
- **Key Accuracy Metric**: Weighted Mean Absolute Percentage Error (wMAPE) comparing `predicted_qty` vs `actual_qty`.

