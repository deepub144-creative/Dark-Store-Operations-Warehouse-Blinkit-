"""
Generates one real, scannable Code128 barcode image per catalog item.
These barcode VALUES must exactly match the `barcode` field in
ordering-app/lib/items.js - that's what the warehouse app's camera
scanner checks against during picking/auditing.

Run: pip install python-barcode[images] --break-system-packages
     python3 generate_item_barcodes.py

Output: ./output/<SKU>.png  - print these and stick them on your mock items.
"""

import os
import barcode
from barcode.writer import ImageWriter

# Keep this list in sync with ordering-app/lib/items.js
ITEMS = [
    ("MILK001", "Full Cream Milk 1L"),
    ("BREAD002", "Brown Bread 400g"),
    ("EGGS003", "Eggs (6 pack)"),
    ("TOMATO004", "Tomato 1kg"),
    ("ONION005", "Onion 1kg"),
    ("BANANA006", "Banana (dozen)"),
    ("PEAS007", "Frozen Green Peas 500g"),
    ("ICECREAM008", "Vanilla Ice Cream 500ml"),
    ("PARATHA009", "Frozen Malabar Paratha"),
    ("RICE010", "Rice 5kg"),
]

os.makedirs("output", exist_ok=True)
CODE128 = barcode.get_barcode_class("code128")

for sku, name in ITEMS:
    writer = ImageWriter()
    code = CODE128(sku, writer=writer)
    code.save(
        f"output/{sku}",
        options={
            "module_width": 0.4,
            "module_height": 18,
            "font_size": 11,
            "text_distance": 4,
            "quiet_zone": 3,
            "write_text": True,
        },
    )
    print(f"Generated output/{sku}.png  ({name})")

print("\nDone. Print these and stick them on your mock items / mini crates.")
