"""Deterministic database schema initializer & synthetic seed script for Audit-X Assistant.

Seeds all 12 core ER entities with realistic quick-commerce warehouse data anchored on
Tiptur HUB - KA44 alongside Tumkur KA06 & Arsikere KA13 dark stores so SQL, RAG, and
report-generation queries return coherent multi-table numbers from day one.
"""

from __future__ import annotations

import json
import os
import random
import sqlite3
from datetime import datetime, timedelta, timezone
from pathlib import Path

ROOT_DIR = Path(__file__).resolve().parent.parent
DATA_DIR = Path(__file__).resolve().parent
SCHEMA_PATH = DATA_DIR / "schema.sql"
DEFAULT_DB_PATH = Path(os.getenv("AUDITX_DB_PATH", str(DATA_DIR / "auditx.db")))

STAGING_RACKS = ["B7", "H2", "D5", "H4", "T1", "T6", "B5", "S4", "T4"]


def _iso(dt: datetime) -> str:
    return dt.replace(microsecond=0).isoformat()


def seed_database(db_path: Path | str = DEFAULT_DB_PATH, force_reset: bool = True) -> dict[str, int]:
    """Create schema and populate synthetic ER entities deterministically."""
    db_file = Path(db_path)
    db_file.parent.mkdir(parents=True, exist_ok=True)

    if force_reset and db_file.exists():
        db_file.unlink()

    conn = sqlite3.connect(str(db_file))
    try:
        conn.execute("PRAGMA foreign_keys = ON;")
        schema_sql = SCHEMA_PATH.read_text(encoding="utf-8")
        conn.executescript(schema_sql)

        rng = random.Random(42)
        # Fixed reference timestamp aligned with project timeline + live queries
        now = datetime.now(timezone.utc)
        created_base = now - timedelta(days=45)

        # 1. DARKSTORES (3 stores)
        darkstores = [
            ("TIPTUR-HUB-KA44", "Tiptur HUB - KA44", "KA44", "Tiptur", "572201", 400, 10.0, 0, _iso(created_base)),
            ("TUMKUR-HUB-KA06", "Tumkur Town HUB - KA06", "KA06", "Tumkur", "572101", 350, 10.0, 0, _iso(created_base)),
            ("ARSIKERE-HUB-KA13", "Arsikere Junction HUB - KA13", "KA13", "Arsikere", "573103", 250, 12.0, 0, _iso(created_base)),
        ]
        conn.executemany(
            "INSERT INTO Darkstore VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
            darkstores,
        )

        # 2. STAFF (9 members, phone numbers strictly masked)
        staff_rows = [
            ("bhaskar", "TIPTUR-HUB-KA44", "Bhaskar N S", "SM", "Store Manager (SM)", "DEV-SM-8431", "Store Control Tower", "******3058", 1, _iso(created_base)),
            ("deepu", "TIPTUR-HUB-KA44", "Deepu B", "ASM", "Assistant Store Manager (ASM)", "DEV-ASM-6364", "Aisle Audit & Putaway", "******0847", 1, _iso(created_base)),
            ("harshitha", "TIPTUR-HUB-KA44", "A B Harshitha", "MD", "Managing Director (MD)", "DEV-MD-8971", "Executive Ops & Margin", "******0997", 1, _iso(created_base)),
            ("thrupthi", "TIPTUR-HUB-KA44", "Thrupthi K S", "PICKER", "OD Picker Lead", "MOTOROLA", "Zone F0-A1-B2", "******5746", 1, _iso(created_base)),
            ("sinchana", "TIPTUR-HUB-KA44", "Sinchana B R", "DELIVERY", "Order Captain Delivery Girl", "OPPO", "Staging Bay & KFGSC Fleet", "******3237", 1, _iso(created_base)),
            ("kiran", "TIPTUR-HUB-KA44", "Kiran Kumar R", "PICKER", "Senior OD Picker", "ZEBRA-TC21", "Cold Chill & Snacks", "******4190", 1, _iso(created_base)),
            ("ravi", "TUMKUR-HUB-KA06", "Ravi Shankar M", "SM", "Tumkur Store Manager", "DEV-SM-6001", "Tumkur Control Tower", "******7712", 1, _iso(created_base)),
            ("ananya", "TUMKUR-HUB-KA06", "Ananya Gowda", "DELIVERY", "EV Delivery Captain", "REALME-PRO", "Tumkur Ring Road", "******6621", 1, _iso(created_base)),
            ("prashanth", "ARSIKERE-HUB-KA13", "Prashanth K", "DELIVERY", "Fleet Rider", "REDMI-OPS", "Arsikere Core", "******8814", 1, _iso(created_base)),
        ]
        conn.executemany(
            "INSERT INTO Staff VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
            staff_rows,
        )

        # 3. RIDERS (4 riders across 3 hubs)
        rider_rows = [
            ("RDR-KA44-01", "sinchana", "TIPTUR-HUB-KA44", "Sinchana B R", "EV Scooter", "KA-44-EV-1018", "DELIVERING", 4.94, 412, 98.2),
            ("RDR-KA44-02", "kiran", "TIPTUR-HUB-KA44", "Kiran Kumar R", "Electric Cycle", "KA-44-EC-204", "AVAILABLE", 4.76, 189, 94.5),
            ("RDR-KA06-01", "ananya", "TUMKUR-HUB-KA06", "Ananya Gowda", "EV Scooter", "KA-06-EV-4421", "AVAILABLE", 4.88, 295, 96.8),
            ("RDR-KA13-01", "prashanth", "ARSIKERE-HUB-KA13", "Prashanth K", "Petrol Bike", "KA-13-HV-7720", "DELIVERING", 4.65, 164, 91.4),
        ]
        conn.executemany(
            "INSERT INTO Rider VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
            rider_rows,
        )

        # 4. PRODUCTS (24 SKUs matching Audit-X dark store catalog)
        products = [
            ("PROD-01", "SKU-TIP-01", "Tiptur Special Copra (Grade-A Dry Coconut)", "Tiptur Specialties", "APMC Tiptur", 220.0, 185.0, 142.0, "1 kg", "F0 - A1 - 001", "89044001001", 180),
            ("PROD-02", "SKU-TIP-02", "Tiptur Cold-Pressed Pure Coconut Oil 1L", "Tiptur Specialties", "Kalpataru Mill", 280.0, 240.0, 186.0, "1 L", "F0 - A1 - 002", "89044001002", 270),
            ("PROD-03", "SKU-TIP-03", "Namma Tiptur Fresh Tender Coconut (Elaneer)", "Tiptur Specialties", "Tiptur Farms", 55.0, 45.0, 31.0, "1 pc", "F0 - A2 - 001", "89044001003", 5),
            ("PROD-04", "SKU-TIP-04", "Nandini Pasteurized Toned Milk 500ml", "Dairy & Breakfast", "Nandini", 27.0, 27.0, 23.5, "500 ml", "A1 - B1 - 001", "89044001004", 3),
            ("PROD-05", "SKU-TIP-05", "Nandini Pure Cow Ghee 500ml", "Dairy & Breakfast", "Nandini", 360.0, 340.0, 285.0, "500 ml", "A1 - B1 - 003", "89044001005", 180),
            ("PROD-06", "SKU-TIP-06", "Nandini Thick Natural Curd 500g", "Dairy & Breakfast", "Nandini", 32.0, 30.0, 24.0, "500 g", "A1 - B2 - 004", "89044001006", 5),
            ("PROD-07", "SKU-TIP-07", "Mysore Sandal Soap Classic Trio (3x150g)", "Personal Care", "KSDL", 240.0, 215.0, 168.0, "450 g", "C2 - D1 - 005", "89044001012", 540),
            ("PROD-08", "SKU-TIP-08", "Royal Mysore Pak Traditional Sweet 250g", "Snacks & Sweets", "Guru Sweets", 180.0, 160.0, 118.0, "250 g", "D1 - E2 - 008", "89044001013", 30),
            ("PROD-09", "SKU-TIP-09", "Fresh Hybrid Red Tomatoes 1kg", "Vegetables & Fruits", "Farm Direct", 35.0, 28.0, 19.0, "1 kg", "F0 - B1 - 002", "89044001008", 6),
            ("PROD-10", "SKU-TIP-10", "Fresh Farm Potatoes (Alugadde) 1kg", "Vegetables & Fruits", "Hassan Produce", 40.0, 32.0, 22.0, "1 kg", "F0 - B1 - 004", "89044001009", 21),
            ("PROD-11", "SKU-TIP-11", "Aashirvaad Shudh Chakki Atta 5kg", "Staples & Grocery", "Aashirvaad", 295.0, 260.0, 212.0, "5 kg", "B1 - A2 - 015", "89044001014", 120),
            ("PROD-12", "SKU-TIP-12", "Tata Tea Gold 500g", "Beverages", "Tata Consumer", 310.0, 275.0, 218.0, "500 g", "C1 - A1 - 004", "89044001016", 365),
            ("PROD-13", "CADBURY-SILK-01", "Cadbury Dairy Milk Silk 150g", "Chocolates & Impulse", "Cadbury", 190.0, 175.0, 134.0, "150 g", "C1 - S1 - 001", "89044001020", 120),
            ("PROD-14", "FERRERO-ROCHER-02", "Ferrero Rocher Hazelnut Box (4 pcs)", "Chocolates & Impulse", "Ferrero", 195.0, 179.0, 138.0, "50 g", "C1 - S1 - 002", "89044001021", 150),
            ("PROD-15", "CHOC-MINI-01", "AuditX ₹1 Bite Chocolate Pack", "Chocolates & Impulse", "Mondelez", 2.0, 1.0, 0.7, "8 g", "C1 - S1 - 005", "89044001022", 180),
            ("PROD-16", "FRAME-A4-01", "Minimalist Black A4 Wall Frame", "Home & Frames", "Karnataka Frames", 350.0, 249.0, 145.0, "450 g", "F1 - R2 - 001", "89044001030", 999),
            ("PROD-17", "FRAME-GOLD-02", "Heritage Gold Desk Photo Frame", "Home & Frames", "Karnataka Frames", 420.0, 299.0, 178.0, "520 g", "F1 - R2 - 002", "89044001031", 999),
            ("PROD-18", "MAGGI-01", "Maggi 2-Minute Masala Noodles (4-Pack)", "Snacks & Sweets", "Nestle", 60.0, 56.0, 46.0, "280 g", "D1 - E1 - 003", "89044001040", 240),
            ("PROD-19", "LAYS-01", "Lay's India's Magic Masala 50g", "Snacks & Sweets", "FritoLay", 20.0, 20.0, 15.0, "50 g", "D1 - E1 - 007", "89044001041", 120),
            ("PROD-20", "AMUL-BUTTER-01", "Amul Pasteurized Butter 500g", "Dairy & Breakfast", "Amul", 285.0, 275.0, 238.0, "500 g", "A1 - B1 - 009", "89044001042", 90),
            ("PROD-21", "BISLERI-01", "Bisleri Mineral Water 1L", "Beverages", "Bisleri", 20.0, 18.0, 11.5, "1 L", "C1 - A2 - 001", "89044001043", 180),
            ("PROD-22", "BRITANNIA-01", "Britannia Good Day Cashew Cookies 200g", "Snacks & Sweets", "Britannia", 45.0, 40.0, 31.0, "200 g", "D1 - E2 - 001", "89044001044", 180),
            ("PROD-23", "SURF-EXCEL-01", "Surf Excel Matic Front Load 1kg", "Home Care", "HUL", 245.0, 220.0, 174.0, "1 kg", "B2 - A1 - 006", "89044001045", 540),
            ("PROD-24", "DETTOL-01", "Dettol Original Liquid Handwash 750ml", "Personal Care", "Reckitt", 189.0, 159.0, 118.0, "750 ml", "C2 - D1 - 011", "89044001046", 540),
        ]
        product_rows = [(*p, _iso(created_base)) for p in products]
        conn.executemany(
            "INSERT INTO Product VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
            product_rows,
        )

        # 5. INVENTORY across darkstores (intentionally create realistic low-stock & zero-stock scenarios)
        sku_to_pid = {p[1]: p[0] for p in products}
        inv_rows = []
        idx = 1
        for s_id, *_ in darkstores:
            for p in products:
                prod_id = p[0]
                sku_code = p[1]
                if s_id == "TIPTUR-HUB-KA44" and sku_code == "FRAME-A4-01":
                    qty, rop = 1, 8       # Single remaining wall frame -> critical low stock
                elif s_id == "TIPTUR-HUB-KA44" and sku_code in ("SKU-TIP-03", "SKU-TIP-09", "CHOC-MINI-01"):
                    qty, rop = 6 if sku_code != "CHOC-MINI-01" else 5, 18
                elif s_id == "TUMKUR-HUB-KA06" and sku_code == "FRAME-GOLD-02":
                    qty, rop = 0, 10      # Out of stock example
                elif s_id == "ARSIKERE-HUB-KA13" and sku_code == "SKU-TIP-05":
                    qty, rop = 4, 12      # Low stock ghee
                else:
                    qty = rng.randint(24, 145)
                    rop = rng.randint(15, 30)
                restock_dt = now - timedelta(hours=rng.randint(2, 72))
                inv_rows.append((f"INV-{idx:03d}", s_id, prod_id, qty, rop, rng.randint(0, 3), _iso(restock_dt)))
                idx += 1
        conn.executemany(
            "INSERT INTO Inventory VALUES (?, ?, ?, ?, ?, ?, ?)",
            inv_rows,
        )

        # 6. CUSTOMERS (28 realistic regional customers)
        customer_names = [
            ("CUST-01", "Darshan Gowda", "Kalpataru College Road", "Tiptur", "572201", "Student"),
            ("CUST-02", "Meghana Kulkarni", "Gandhi Circle", "Tiptur", "572201", "VIP"),
            ("CUST-03", "Raghavendra Bhat", "B.H. Road Main", "Tiptur", "572201", "VIP"),
            ("CUST-04", "Divya Shree K", "Vidyanagar", "Tiptur", "572201", "Regular"),
            ("CUST-05", "Chethan Patil", "APMC Yard Road", "Tiptur", "572201", "Regular"),
            ("CUST-06", "Nandini Prasad", "KFGSC Campus Quarters", "Tiptur", "572201", "VIP"),
            ("CUST-07", "Suresh Babu T", "KR Extension", "Tiptur", "572201", "Regular"),
            ("CUST-08", "Kavya Narasimha", "Shanthinagar", "Tiptur", "572201", "VIP"),
            ("CUST-09", "Manjunath H S", "Hassan Circle", "Tiptur", "572201", "Regular"),
            ("CUST-10", "Spoorti Rao", "Railway Station Road", "Tiptur", "572201", "New"),
            ("CUST-11", "Harish Shetty", "SS Puram", "Tumkur", "572101", "VIP"),
            ("CUST-12", "Pooja Deshmukh", "SIT Extension", "Tumkur", "572102", "Student"),
            ("CUST-13", "Vinayak Hegde", "Batawadi", "Tumkur", "572103", "Regular"),
            ("CUST-14", "Aishwarya Murthy", "Ashok Nagar", "Tumkur", "572101", "VIP"),
            ("CUST-15", "Karthikeya V", "Jayanagar East", "Tumkur", "572102", "Regular"),
            ("CUST-16", "Lakshmi Devi", "Subhash Nagar", "Arsikere", "573103", "VIP"),
            ("CUST-17", "Praveen Joshi", "BG Palya", "Arsikere", "573103", "Regular"),
            ("CUST-18", "Sahana R", "Kalpataru Women's Hostel", "Tiptur", "572201", "Student"),
            ("CUST-19", "Nithin Kumar B", "Maruthi Nagar", "Tiptur", "572201", "New"),
            ("CUST-20", "Anitha Mohan", "Siddaganga Extension", "Tumkur", "572102", "Regular"),
        ]
        cust_rows = []
        for cid, cname, area, city, pin, seg in customer_names:
            phone_masked = f"******{rng.randint(1000, 9999)}"
            cust_rows.append((cid, cname, phone_masked, area, city, pin, seg, float(rng.randint(450, 9500)), _iso(created_base)))
        conn.executemany(
            "INSERT INTO Customer VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
            cust_rows,
        )

        # 7, 8, 9. ORDERS, ORDER_ITEMS, DELIVERIES (160 orders over last 21 days including today)
        store_pickers = {
            "TIPTUR-HUB-KA44": ["thrupthi", "kiran"],
            "TUMKUR-HUB-KA06": ["ravi"],
            "ARSIKERE-HUB-KA13": ["prashanth"],
        }
        store_riders = {
            "TIPTUR-HUB-KA44": ["RDR-KA44-01", "RDR-KA44-02"],
            "TUMKUR-HUB-KA06": ["RDR-KA06-01"],
            "ARSIKERE-HUB-KA13": ["RDR-KA13-01"],
        }
        product_weights = [
            12, 10, 14, 18, 8, 12, 6, 9, 13, 10, 8, 9,
            11, 7, 15, 4, 3, 12, 14, 7, 10, 9, 5, 6,
        ]

        orders_rows = []
        oi_rows = []
        deliv_rows = []
        oi_counter = 1
        deliv_counter = 1

        for idx in range(1, 161):
            order_id = f"ORD-2026-{4000 + idx}"
            # Weight 62% of orders to primary Tiptur hub
            s_choice = rng.choices(
                ["TIPTUR-HUB-KA44", "TUMKUR-HUB-KA06", "ARSIKERE-HUB-KA13"],
                weights=[62, 24, 14],
            )[0]
            if s_choice == "TIPTUR-HUB-KA44":
                cust_id = rng.choice([c[0] for c in cust_rows if c[4] == "Tiptur"])
            elif s_choice == "TUMKUR-HUB-KA06":
                cust_id = rng.choice([c[0] for c in cust_rows if c[4] == "Tumkur"])
            else:
                cust_id = rng.choice([c[0] for c in cust_rows if c[4] == "Arsikere"])

            days_ago = 0 if idx > 138 else rng.randint(1, 21)
            order_dt = now - timedelta(days=days_ago, hours=rng.randint(0, 14), minutes=rng.randint(0, 59))
            picker_id = rng.choice(store_pickers[s_choice])
            rider_id = rng.choice(store_riders[s_choice])
            rack = rng.choice(STAGING_RACKS)

            # Status funnel: recent orders spread across active funnel stages
            if days_ago == 0 and idx > 152:
                status = rng.choice(["PLACED", "PICKING", "STAGED", "DISPATCHED"])
            elif idx % 27 == 0:
                status = "CANCELLED"
            else:
                status = "DELIVERED"

            chosen_prods = rng.choices(products, weights=product_weights, k=rng.randint(2, 4))
            # deduplicate within same order
            seen_p = set()
            line_items = []
            subtotal = 0.0
            for cp in chosen_prods:
                if cp[0] in seen_p:
                    continue
                seen_p.add(cp[0])
                qty = rng.randint(1, 3)
                unit_price = cp[6]
                line_total = round(qty * unit_price, 2)
                subtotal += line_total
                scan_status = "PENDING" if status in ("PLACED", "PICKING") else "VERIFIED"
                line_items.append((f"OI-{oi_counter:04d}", order_id, cp[0], qty, unit_price, line_total, scan_status))
                oi_counter += 1

            discount = round(subtotal * rng.choice([0.0, 0.0, 0.05, 0.10]), 2)
            total_amt = round(max(1.0, subtotal - discount), 2)
            pick_mins = round(rng.uniform(1.2, 2.8), 2)
            sla_target = 12.0 if s_choice == "ARSIKERE-HUB-KA13" else 10.0

            delivered_at = None
            actual_mins = None
            if status == "DELIVERED":
                ride_mins = round(rng.uniform(4.6, 8.9), 2)
                actual_mins = round(pick_mins + ride_mins, 2)
                delivered_at = _iso(order_dt + timedelta(minutes=actual_mins))

            orders_rows.append((
                order_id, s_choice, cust_id, picker_id, rider_id,
                status, round(subtotal, 2), discount, total_amt,
                sla_target, pick_mins, actual_mins, rack, _iso(order_dt), delivered_at
            ))
            oi_rows.extend(line_items)

            if status in ("DISPATCHED", "DELIVERED"):
                pickup_dt = order_dt + timedelta(minutes=pick_mins)
                dispatch_dt = pickup_dt + timedelta(seconds=35)
                dist_km = round(rng.uniform(0.7, 2.8), 2)
                breached = 1 if (actual_mins is not None and actual_mins > sla_target) else 0
                rating = round(rng.uniform(4.2, 5.0), 1) if status == "DELIVERED" else None
                deliv_rows.append((
                    f"DEL-{deliv_counter:04d}", order_id, rider_id,
                    _iso(pickup_dt), _iso(dispatch_dt), delivered_at,
                    dist_km, round(sla_target - pick_mins, 1),
                    actual_mins, breached, rating
                ))
                deliv_counter += 1

        conn.executemany(
            'INSERT INTO "Order" VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
            orders_rows,
        )
        conn.executemany(
            "INSERT INTO Order_Item VALUES (?, ?, ?, ?, ?, ?, ?)",
            oi_rows,
        )
        conn.executemany(
            "INSERT INTO Delivery VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
            deliv_rows,
        )

        # 10. DEMAND_FORECAST (10 days history + next 4 days across top 10 SKUs at primary hub + peers)
        forecast_rows = []
        fc_idx = 1
        top_forecast_skus = products[:10]
        for day_offset in range(-10, 5):
            f_date = (now + timedelta(days=day_offset)).strftime("%Y-%m-%d")
            for p in top_forecast_skus:
                for s_id in ("TIPTUR-HUB-KA44", "TUMKUR-HUB-KA06"):
                    base = 42 if s_id == "TIPTUR-HUB-KA44" else 24
                    if p[0] in ("PROD-04", "PROD-03", "PROD-09"):
                        base += 28
                    pred = max(6, base + rng.randint(-8, 14))
                    actual = None if day_offset > 0 else max(3, pred + rng.randint(-6, 7))
                    conf = round(rng.uniform(0.84, 0.96), 3)
                    forecast_rows.append((
                        f"FC-{fc_idx:04d}", s_id, p[0], f_date, pred, actual, conf, "Prophet-v1.3"
                    ))
                    fc_idx += 1
        conn.executemany(
            "INSERT INTO Demand_Forecast VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
            forecast_rows,
        )

        # 11. SHRINKAGE_DUMP_LOG (28 realistic write-off entries)
        shrink_templates = [
            ("FRAME-A4-01", "DAMAGED", 1, 145.0, "deepu", "TIPTUR-HUB-KA44"),
            ("PROD-04", "EXPIRED", 6, 141.0, "deepu", "TIPTUR-HUB-KA44"),
            ("PROD-06", "COLD_CHAIN_BREACH", 4, 96.0, "bhaskar", "TIPTUR-HUB-KA44"),
            ("PROD-09", "DAMAGED", 5, 95.0, "deepu", "TIPTUR-HUB-KA44"),
            ("PROD-03", "EXPIRED", 3, 93.0, "thrupthi", "TIPTUR-HUB-KA44"),
            ("CADBURY-SILK-01", "COLD_CHAIN_BREACH", 2, 268.0, "harshitha", "TIPTUR-HUB-KA44"),
            ("PROD-02", "LEAKAGE", 1, 186.0, "ravi", "TUMKUR-HUB-KA06"),
            ("PROD-10", "DAMAGED", 4, 88.0, "ravi", "TUMKUR-HUB-KA06"),
            ("PROD-04", "EXPIRED", 5, 117.5, "prashanth", "ARSIKERE-HUB-KA13"),
            ("FRAME-GOLD-02", "DAMAGED", 2, 356.0, "deepu", "TIPTUR-HUB-KA44"),
        ]
        shrink_rows = []
        for idx in range(1, 29):
            tmpl = shrink_templates[(idx - 1) % len(shrink_templates)]
            qty_mult = rng.randint(1, 2)
            qty = tmpl[2] * qty_mult
            loss = round(tmpl[3] * qty_mult, 2)
            dt = now - timedelta(days=rng.randint(0, 18), hours=rng.randint(1, 10))
            shrink_rows.append((
                f"DUMP-{idx:03d}", tmpl[5], sku_to_pid.get(tmpl[0], tmpl[0]), tmpl[4], tmpl[1], qty, loss, "APPROVED_WRITE_OFF", _iso(dt)
            ))
        conn.executemany(
            "INSERT INTO Shrinkage_Dump_Log VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
            shrink_rows,
        )

        # 12. RAG_QUERY_LOG (8 historical queries for analytics)
        seed_logs = [
            ("LOG-001", "sess-demo-1", "Admin", "How is the 10-minute SLA split?", "Explain the 10-minute SLA breakdown between picking and delivery in Audit-X.", "explain", "RAG", 1, '["auditx_overview#0"]', None, 0.91, 142, "up", _iso(now - timedelta(hours=5))),
            ("LOG-002", "sess-demo-1", "Admin", "Top 5 products by revenue this week", "Top 5 products by revenue this week", "data-query", "SQL", 0, "[]", 'SELECT p.name, SUM(oi.line_total) AS revenue FROM Order_Item oi JOIN Product p ON oi.product_id = p.product_id GROUP BY p.product_id ORDER BY revenue DESC LIMIT 5', 0.96, 68, "up", _iso(now - timedelta(hours=4))),
            ("LOG-003", "sess-demo-2", "Store Staff", "Which items are low in stock at Tiptur HUB?", "Which inventory items are below reorder_point at TIPTUR-HUB-KA44?", "data-query", "SQL", 0, "[]", 'SELECT p.sku_code, p.name, i.qty_available, i.reorder_point FROM Inventory i JOIN Product p ON i.product_id = p.product_id WHERE i.store_id = \'TIPTUR-HUB-KA44\' AND i.qty_available <= i.reorder_point LIMIT 20', 0.94, 54, "up", _iso(now - timedelta(hours=3))),
            ("LOG-004", "sess-demo-2", "Admin", "Write a Python binary search function", "Write a Python binary search function", "general", "General", 0, "[]", None, 1.0, 41, "up", _iso(now - timedelta(hours=2))),
        ]
        conn.executemany(
            "INSERT INTO Rag_Query_Log VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
            seed_logs,
        )

        conn.commit()

        # Return row summary for verification
        tables = [
            "Darkstore", "Staff", "Customer", "Product", "Inventory",
            "Rider", "Order", "Order_Item", "Delivery",
            "Demand_Forecast", "Shrinkage_Dump_Log", "Rag_Query_Log",
        ]
        counts = {}
        for t in tables:
            row = conn.execute(f'SELECT COUNT(*) FROM "{t}"').fetchone()
            counts[t] = row[0]
        return counts
    finally:
        conn.close()


if __name__ == "__main__":
    summary = seed_database(DEFAULT_DB_PATH, force_reset=True)
    print(f"Seeded {DEFAULT_DB_PATH}:")
    for table_name, cnt in summary.items():
        print(f"  - {table_name:22s}: {cnt} rows")
