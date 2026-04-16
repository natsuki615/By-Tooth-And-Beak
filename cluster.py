import pandas as pd
import numpy as np
import umap
import hdbscan

# ── 1. Load data ──────────────────────────────────────────────────────────────
df = pd.read_csv("dietdb.csv")

# ── 2. Diet-fraction vector per species ───────────────────────────────────────
# Drop rows with no Prey_Class data before grouping (19 species in the CSV have
# only NaN prey entries — they're tracked separately and get NaN coords later).
all_species = df["Common_Name"].unique()
df_known = df.dropna(subset=["Prey_Class"])

diet = (
    df_known.groupby(["Common_Name", "Prey_Class"])["Fraction_Diet"]
    .mean()
    .unstack(fill_value=0)
)
diet = diet.div(diet.sum(axis=1), axis=0)  # rows sum to 1

no_data_species = sorted(set(all_species) - set(diet.index))
print(f"Diet matrix shape: {diet.shape}  ({len(no_data_species)} species have no prey data)")

# ── 3. UMAP → 2D coords per species ──────────────────────────────────────────
reducer = umap.UMAP(n_components=2, random_state=42, metric="cosine")
coords = reducer.fit_transform(diet.values)   # shape (n_known_species, 2)

coords_df = pd.DataFrame(coords, index=diet.index, columns=["x", "y"])

# Append the no-data species as NaN rows so every species is represented
no_data_df = pd.DataFrame(
    np.nan, index=no_data_species, columns=["x", "y"]
)
no_data_df.index.name = "Common_Name"
coords_df = pd.concat([coords_df, no_data_df])

print(f"coords_df shape: {coords_df.shape}  (includes {len(no_data_species)} NaN rows)")
print("\nUMAP coords (first 5):")
print(coords_df.head())
print(f"\nNo-data species ({len(no_data_species)}):")
print(no_data_species)

# ── 4. HDBSCAN clustering on the 2D UMAP coords ──────────────────────────────
# Run only on species with real coords; no-data species get label NaN.
known_coords = coords_df.dropna()

clusterer = hdbscan.HDBSCAN(
    min_cluster_size=10,   # smallest meaningful diet group
    min_samples=5,         # controls how conservative outlier detection is
    metric="euclidean",
)
labels = clusterer.fit_predict(known_coords.values)  # -1 = noise/outlier

known_coords = known_coords.copy()
known_coords["cluster"] = labels

# Re-attach no-data species with NaN cluster label
no_data_clusters = pd.DataFrame(
    {"x": np.nan, "y": np.nan, "cluster": np.nan},
    index=no_data_species,
)
no_data_clusters.index.name = "Common_Name"
coords_df = pd.concat([known_coords, no_data_clusters])

n_clusters = (labels >= 0).sum()
n_noise    = (labels == -1).sum()
print(f"\nHDBSCAN: {labels.max() + 1} clusters, {n_noise} noise points")

# Save both artefacts for downstream use
diet.to_csv("diet_vectors.csv")
coords_df.to_csv("umap_coords.csv")
print("Saved diet_vectors.csv and umap_coords.csv")
