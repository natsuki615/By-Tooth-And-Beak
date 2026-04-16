import pandas as pd
import numpy as np
import matplotlib.pyplot as plt
import matplotlib.patches as mpatches

coords = pd.read_csv("data/ords.csv", index_col=0)
diet   = pd.read_csv("data/diet_vectors.csv", index_col=0)

# Dominant prey class per species (for coloring)
dominant = diet.idxmax(axis=1)

# Collapse rare classes (< 10 species) into "Other"
top_classes = dominant.value_counts()[dominant.value_counts() >= 10].index.tolist()
dominant = dominant.apply(lambda c: c if c in top_classes else "Other")

COLOR_MAP = {
    "Insecta":"#f4a261",   
    "Magnoliopsida": "#2a9d8f",
    "Teleostei":"#457b9d",
    "Mammalia":"#e76f51", 
    "Malacostraca": "#8ecae6",
    "Cephalopoda": "#6a4c93", 
    "Euchelicerata": "#a8dadc",
    "Gastropoda": "#c9ada7",
    "Bivalvia": "#b5e48c",
    "Pinopsida": "#1b4332",
    "Other": "#d3d3d3",
}

fig, ax = plt.subplots(figsize=(12, 9))
fig.patch.set_facecolor("#1a1a2e")
ax.set_facecolor("#1a1a2e")

# Plot known-diet species, grouped by dominant class
known = coords.dropna()
for cls, color in COLOR_MAP.items():
    mask = dominant.reindex(known.index) == cls
    subset = known[mask]
    ax.scatter(
        subset["x"], subset["y"],
        c=color, s=18, alpha=0.75, linewidths=0,
        label=cls,
        zorder=2,
    )

# Plot no-data species as hollow white markers
no_data = coords[coords.isna().any(axis=1)]
# Place them off-plot as a marginal strip (x = max+2, evenly spaced y)
if len(no_data):
    x_offset = known["x"].max() + 2.5
    ys = np.linspace(known["y"].min(), known["y"].max(), len(no_data))
    ax.scatter(
        [x_offset] * len(no_data), ys,
        c="none", edgecolors="white", s=22, linewidths=0.8,
        alpha=0.6, zorder=2, label="No data",
    )
    ax.axvline(x_offset - 1.2, color="white", lw=0.4, alpha=0.2, linestyle="--")

# Legend
handles = [
    mpatches.Patch(color=c, label=cls)
    for cls, c in COLOR_MAP.items()
    if cls in dominant.values or cls == "Other"
]
handles.append(
    plt.Line2D([0], [0], marker="o", color="none",
               markerfacecolor="none", markeredgecolor="white",
               markersize=6, label="No data")
)
ax.legend(
    handles=handles, title="Dominant prey class",
    title_fontsize=9, fontsize=8,
    framealpha=0.15, labelcolor="white",
    facecolor="#1a1a2e", edgecolor="#444",
    loc="upper left",
)
ax.set_title("Bird diet space  —  UMAP (cosine distance)", color="white", fontsize=14, pad=12)
ax.tick_params(colors="white", labelsize=8)
for spine in ax.spines.values():
    spine.set_edgecolor("#444")
ax.set_xlabel("UMAP 1", color="#aaa", fontsize=9)
ax.set_ylabel("UMAP 2", color="#aaa", fontsize=9)

plt.tight_layout()
plt.savefig("umap_plot.png", dpi=150, bbox_inches="tight", facecolor=fig.get_facecolor())
print("Saved umap_plot.png")
