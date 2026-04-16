import pandas as pd
import numpy as np
import umap
import hdbscan
import rasterfairy

#  1. load data 
df = pd.read_csv("data/dietdb.csv")

#  2. diet-fraction vector per species
# drop rows with no Prey_Class data before grouping 
# (species with NaN prey entries are tracked separately)
all_species = df["Common_Name"].unique()
df_known = df.dropna(subset=["Prey_Class"])

diet = (
    df_known.groupby(["Common_Name", "Prey_Class"])["Fraction_Diet"]
    .mean()
    .unstack(fill_value=0)
)
diet = diet.div(diet.sum(axis=1), axis=0)

no_data_species = sorted(set(all_species) - set(diet.index))
print(f"Diet matrix shape: {diet.shape}  ({len(no_data_species)} species have no prey data)")

# 3. umap to 2d coords per species 
reducer = umap.UMAP(n_components=2, random_state=42, metric="cosine")
coords = reducer.fit_transform(diet.values)   # shape (n_known_species, 2)

coords_df = pd.DataFrame(coords, index=diet.index, columns=["x", "y"])

# append the no-data species as NaN rows so every species is represented
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

#  4. hdbscan clustering on the 2D umap coords 
# run only on species with real coords, no-data species get label NaN.
known_coords = coords_df.dropna()

clusterer = hdbscan.HDBSCAN(
    min_cluster_size=10, # smallest meaningful diet group
    min_samples=5, # controls how conservative outlier detection is
    metric="euclidean",
)
labels = clusterer.fit_predict(known_coords.values)  # -1 = noise/outlier

known_coords = known_coords.copy()
known_coords["cluster"] = labels

# re-attach no-data species with NaN cluster label
no_data_clusters = pd.DataFrame(
    {"x": np.nan, "y": np.nan, "cluster": np.nan},
    index=no_data_species,
)
no_data_clusters.index.name = "Common_Name"
coords_df = pd.concat([known_coords, no_data_clusters])

n_clusters = (labels >= 0).sum()
n_noise    = (labels == -1).sum()
print(f"\nHDBSCAN: {labels.max() + 1} clusters, {n_noise} noise points")

# 5. rasterfairy grid layout 
# transformPointCloud2D expects a (n, 2) float array, run only on known species.
grid_xy, (grid_cols, grid_rows) = rasterfairy.transformPointCloud2D(
    known_coords[["x", "y"]].values
)

known_coords = known_coords.copy()
known_coords["grid_x"] = grid_xy[:, 0].astype(int)
known_coords["grid_y"] = grid_xy[:, 1].astype(int)

# re-attach no-data species with NaN grid positions
no_data_clusters["grid_x"] = np.nan
no_data_clusters["grid_y"] = np.nan
coords_df = pd.concat([known_coords, no_data_clusters])

print(f"Rasterfairy grid: {grid_cols} cols x {grid_rows} rows")

# save both artefacts for downstream use
diet.to_csv("data/diet_vectors.csv")
coords_df.to_csv("data/umap_coords.csv")
print("Saved data/diet_vectors.csv and data/umap_coords.csv")
