import pandas as pd
import json


def build_prey_links(diet_path="data/dietdb.csv", umap_path="data/umap_coords.csv",
                     out_path="data/aves_prey_links.json"):
    diet = pd.read_csv(diet_path, low_memory=False)
    umap = pd.read_csv(umap_path)

    umap_names = set(umap["Common_Name"])
    lower_to_canonical = {} # "american robin" -> "American Robin"
    for n in umap_names:
        lower_to_canonical[n.lower()] = n

    # filter the dataset to only have the rows where Prey_Class == Aves
    aves_rows = diet[diet["Prey_Class"] == "Aves"]

    # { "Bald Eagle": ["Mallard", "American Coot", ...], ... }
    prey_map = {}
    for _, row in aves_rows.iterrows():
        predator = row["Common_Name"]
        prey_raw = row["Prey_Common_Name"]

        # error handling
        if predator not in umap_names:
            continue
        if not isinstance(prey_raw, str):
            continue

        prey_canonical = lower_to_canonical.get(prey_raw.strip().lower())
        if prey_canonical is None:
            continue

        if predator not in prey_map:
            prey_map[predator] = []
        if prey_canonical not in prey_map[predator]:
            prey_map[predator].append(prey_canonical)

    with open(out_path, "w") as f:
        json.dump(prey_map, f, indent=2)

    print(f"Unique predators: {len(prey_map)}")
    for predator, prey_list in prey_map.items():
        print(f"  {predator}: {prey_list}")

    return prey_map


if __name__ == "__main__":
    build_prey_links()
