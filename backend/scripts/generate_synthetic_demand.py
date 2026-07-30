import pandas as pd
import numpy as np
import os
from datetime import datetime, timedelta

np.random.seed(42)

DATA_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "..", "data")
EXISTING_CSV = os.path.join(DATA_DIR, "dataset.csv")
OUTPUT_CSV = os.path.join(DATA_DIR, "synthetic_demand_history.csv")

if not os.path.exists(EXISTING_CSV):
    print(f"Existing dataset not found at {EXISTING_CSV}, skipping generation")
    exit(0)

df = pd.read_csv(EXISTING_CSV)

products = df[['Product_ID', 'Product_Name', 'Category', 'Supplier', 'Season']].drop_duplicates('Product_ID')
product_demand = df.groupby('Product_ID')['Demand'].median().to_dict()
product_inventory = df.groupby('Product_ID')['Inventory_Level'].mean().to_dict()

NUM_DAYS = 90
start_date = datetime(2025, 10, 1)

cat_demand_mult = {
    'Dairy': 1.0, 'Bakery': 0.9, 'Beverages': 1.15, 'Frozen': 0.85,
    'Fruits': 1.0, 'Grains': 0.85, 'Household': 0.6, 'Meat': 1.2,
    'Snacks': 1.05, 'Vegetables': 1.0,
}

dow_mult = [1.0, 1.0, 1.0, 1.0, 1.05, 1.25, 0.75]

rows = []
for _, prod in products.iterrows():
    pid = prod['Product_ID']
    base_demand = product_demand.get(pid, 50)
    cat = prod['Category']
    cm = cat_demand_mult.get(cat, 1.0)

    for day in range(NUM_DAYS):
        date = start_date + timedelta(days=day)
        dow = date.weekday()

        dm = dow_mult[dow]
        trend = 1.0 + (day / NUM_DAYS - 0.5) * 0.15
        noise = np.random.normal(1.0, 0.12)

        demand_val = base_demand * cm * dm * trend * noise
        demand_val = max(1, round(demand_val))

        row = {
            'date': date.strftime('%Y-%m-%d'),
            'product_id': pid,
            'product_name': prod['Product_Name'],
            'category': cat,
        }

        row['demand'] = demand_val
        row['day_of_week'] = dow

        if cat == 'Frozen':
            month = date.month
            temp_factor = 1.0 + (1 if month in [6, 7, 8] else 0)
            row['demand'] = max(1, round(row['demand'] * temp_factor))

        rows.append(row)

result_df = pd.DataFrame(rows)
result_df = result_df.sort_values(['product_id', 'date']).reset_index(drop=True)
result_df.to_csv(OUTPUT_CSV, index=False)
print(f"Generated {len(result_df)} synthetic demand records ({products['Product_ID'].nunique()} products, {NUM_DAYS} days each)")
print(f"Saved to {OUTPUT_CSV}")
