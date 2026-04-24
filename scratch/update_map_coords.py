from PIL import Image
import os
import json

base = r"c:\Users\manba\.gemini\antigravity\scratch\sabor-de-espana"
old_map_path = os.path.join(base, "assets", "images", "mapa-blanco_cut.png")
new_map_path = os.path.join(base, "assets", "images", "mapa-reduce.png")
json_path = os.path.join(base, "data", "provincesData.json")

old_img = Image.open(old_map_path)
new_img = Image.open(new_map_path)

# getbbox() returns (left, upper, right, lower) of the non-zero (non-transparent) area
old_bbox = old_img.getbbox()
new_bbox = new_img.getbbox()

print(f"Old Map bbox: {old_bbox}")
print(f"New Map bbox: {new_bbox}")

# If the new map is just the old map cropped to its bounding box, or similar, we can calculate the offset.
# The top-left of the content in old_map is at old_bbox[0], old_bbox[1].
# The top-left of the content in new_map is at new_bbox[0], new_bbox[1].
# This means the content moved relative to the image borders by:
# content_shift_x = old_bbox[0] - new_bbox[0]
content_shift_x = old_bbox[0] - new_bbox[0]

# Now, we also must account for the fact that Phaser centers both images.
# Old map was placed at x=960. Its top-left in canvas is 960 - 1744/2 = 88.
# New map is placed at x=960. Its top-left in canvas is 960 - 1282/2 = 319.
# The image itself is visually shifted right by 319 - 88 = 231 pixels.
# The content inside the image is shifted left (relative to the image border) by content_shift_x.
# So the total canvas shift is:
shift_x = 231 - content_shift_x

print(f"Calculated Canvas Shift X: {shift_x}")

# Let's apply it just to see
with open(json_path, 'r', encoding='utf-8') as f:
    data = json.load(f)

for p in data:
    p['x'] = p['x'] + shift_x

with open(json_path, 'w', encoding='utf-8') as f:
    json.dump(data, f, ensure_ascii=False, indent=4)

print("JSON updated successfully!")
