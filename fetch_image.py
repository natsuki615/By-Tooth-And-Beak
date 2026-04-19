from rembg import remove
from PIL import Image
import requests
from io import BytesIO
import pandas as pd
import os

CUTOUTS_DIR = "cutouts"
os.makedirs(CUTOUTS_DIR, exist_ok=True)

birds = pd.read_csv("data/umap_coords.csv")
taxonomy = pd.read_csv("data/eBird_taxonomy_v2025.csv")

# Build a lookup from common name -> species code
name_to_code = dict(zip(taxonomy["PRIMARY_COM_NAME"], taxonomy["SPECIES_CODE"]))


# 1. Go through umap_coords, look up species code from eBird_taxonomy_v2025.csv
def get_species_code(common_name):
    return name_to_code.get(common_name)


# 2. Get mediaUrl from Macaulay Library API using species code
def get_mediaurl(species_code):
    url = f"https://search.macaulaylibrary.org/api/v1/search?taxonCode={species_code}&mediaType=photo&count=1&sort=rating_rank_desc"
    response = requests.get(url)
    data = response.json()
    content = data.get("results", {}).get("content", [])
    if not content:
        return None
    return content[0].get("mediaUrl")


# 3. Remove background and save to /cutouts with bird name as file name
def get_cutout(name, image_url):
    res = requests.get(image_url)
    img = Image.open(BytesIO(res.content))
    cutout = remove(img)
    safe_name = name.replace(" ", "_").replace("'", "")
    cutout.save(os.path.join(CUTOUTS_DIR, f"{safe_name}.png"))
    print(f"Saved: {safe_name}.png")


def main():
    for _, row in birds.iterrows():
        common_name = row["Common_Name"]
        species_code = get_species_code(common_name)
        if species_code is None:
            print(f"No species code found for: {common_name}")
            continue

        media_url = get_mediaurl(species_code)
        if media_url is None:
            print(f"No image found for: {common_name} ({species_code})")
            continue

        get_cutout(common_name, media_url)


if __name__ == "__main__":
    main()
