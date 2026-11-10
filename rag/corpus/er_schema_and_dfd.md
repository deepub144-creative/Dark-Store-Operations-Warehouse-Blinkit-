# Audit-X ER Schema & Data Flow Diagrams (12 Normalized Entities)

## Relational Entity-Relationship Model

Audit-X models both operational dark-store workflows and AI observability using 12 normalized tables in SQLite (`data/auditx.db`) / PostgreSQL:

1. **`Darkstore`** (`store_id` PK, `store_name`, `hub_code`, `city`, `pincode`, `order_cap_limit`, `sla_target_mins`, `is_paused`): Dark store micro-fulfillment centers such as `TIPTUR-HUB-KA44` (10-min SLA, 400-device cap).
2. **`Staff`** (`staff_id` PK, `store_id` FK -> `Darkstore`, `name`, `role_code`, `designation`, `device_id`, `zone`, `phone_masked`, `active`): Personnel roster covering `SM`, `ASM`, `MD`, `PICKER`, `DELIVERY`.
3. **`Customer`** (`customer_id` PK, `name`, `phone_masked`, `neighborhood`, `city`, `pincode`, `segment`, `wallet_balance`): Quick-commerce buyers across Tiptur, Tumkur, and Arsikere segments (`VIP`, `Regular`, `Student`, `New`).
4. **`Product`** (`product_id` PK, `sku_code`, `name`, `category`, `brand`, `mrp`, `price`, `cost_price`, `unit_weight`, `bin_location`, `barcode`, `expiry_days`): Master catalog spanning Tiptur Specialties (Copra, Coconut Oil, Elaneer), Dairy & Breakfast, Chocolates & Impulse, Vegetables & Fruits, Staples, Home & Frames.
5. **`Inventory`** (`inventory_id` PK, `store_id` FK, `product_id` FK, `qty_available`, `reorder_point`, `reserved_qty`, `last_restocked_at`): Store-level live shelf balance triggering automatic OOS (`qty_available = 0`) and replenishment alerts when `qty_available <= reorder_point`.
6. **`Rider`** (`rider_id` PK, `staff_id` FK -> `Staff`, `store_id` FK -> `Darkstore`, `name`, `vehicle_type`, `vehicle_no`, `status`, `rating_avg`, `total_deliveries`, `on_time_rate`): Last-mile delivery fleet performance ledger.
7. **`"Order"`** (`order_id` PK, `store_id` FK, `customer_id` FK, `picker_staff_id` FK, `rider_id` FK, `status`, `subtotal`, `discount_amount`, `total_amount`, `sla_target_mins`, `pick_mins`, `actual_mins`, `staging_rack`, `created_at`, `delivered_at`): End-to-end order lifecycle state machine (`PLACED` -> `PICKING` -> `STAGED` -> `DISPATCHED` -> `DELIVERED` / `CANCELLED`).
8. **`Order_Item`** (`order_item_id` PK, `order_id` FK, `product_id` FK, `quantity`, `unit_price`, `line_total`, `scan_status`): Line-level breakdown per order enabling revenue, top-selling SKU, and category mix queries.
9. **`Delivery`** (`delivery_id` PK, `order_id` FK UNIQUE, `rider_id` FK, `pickup_at`, `dispatched_at`, `delivered_at`, `distance_km`, `eta_mins`, `actual_mins`, `sla_breached`, `customer_rating`): Granular last-mile telemetry for SLA audit.
10. **`Demand_Forecast`** (`forecast_id` PK, `store_id` FK, `product_id` FK, `forecast_date`, `predicted_qty`, `actual_qty`, `confidence_score`, `model_version`): Time-series demand predictions vs realized unit sales.
11. **`Shrinkage_Dump_Log`** (`dump_id` PK, `store_id` FK, `product_id` FK, `logged_by_staff_id` FK, `reason`, `qty`, `loss_amount`, `status`, `logged_at`): Damaged, expired, leakage, and cold-chain breach write-offs.
12. **`Rag_Query_Log`** (`log_id` PK, `session_id`, `user_role`, `user_query`, `rewritten_query`, `intent`, `response_mode`, `viva_mode`, `retrieved_chunk_ids`, `sql_generated`, `grounding_score`, `latency_ms`, `feedback`, `created_at`): Full AI audit trail for evaluation & feedback tuning.

## Entity Relationships & Cardinalities
- `Darkstore` (1) ---> (N) `Staff`, `Inventory`, `"Order"`, `Demand_Forecast`, `Shrinkage_Dump_Log`, `Rider`
- `Product` (1) ---> (N) `Inventory`, `Order_Item`, `Demand_Forecast`, `Shrinkage_Dump_Log`
- `Customer` (1) ---> (N) `"Order"`
- `"Order"` (1) ---> (N) `Order_Item`
- `"Order"` (1) ---> (0..1) `Delivery`
- `Rider` (1) ---> (N) `Delivery`

## Staging Racks (9 Physical Handover Bays at Tiptur HUB KA44)
Fixed staging racks link Picking to Dispatch: `B7` (Bakery & Staples), `H2` (Heavy & Bulky), `D5` (Ambient Dispatch), `H4` (Heavy & Bulky 4), `T1` (Cold Chill 1), `T6` (Cold Chill 6), `B5` (Bakery & Staples 5), `S4` (Snacks & Sweets 4), `T4` (Cold Chill 4). Each rack carries a Code128/QR label (`AUDITX-RACK-{ID}-TIPTUR-KA44`).

