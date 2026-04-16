import pyreadr

result = pyreadr.read_r("data/dietdb.rda")
print(result.keys())
for name, df in result.items():
    df.to_csv(f"{name}.csv", index=False)
    print(f"Saved {name}.csv — {df.shape[0]} rows, {df.shape[1]} cols")