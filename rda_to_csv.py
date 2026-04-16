import pyreadr
import os

result = pyreadr.read_r("data/dietdb.rda")

# .rda files can contain multiple objects — list them
print(result.keys())

# Export each one to CSV
for name, df in result.items():
    df.to_csv(f"{name}.csv", index=False)
    print(f"Saved {name}.csv — {df.shape[0]} rows, {df.shape[1]} cols")