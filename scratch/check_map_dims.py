from PIL import Image
import os

def check_dims(path):
    try:
        with Image.open(path) as img:
            return img.size
    except Exception as e:
        return str(e)

base = r"c:\Users\manba\.gemini\antigravity\scratch\sabor-de-espana"
map_current = os.path.join(base, "assets", "images", "mapa-blanco_cut.png")
map_reduce = os.path.join(base, "assets", "images", "mapa-reduce.png")

print(f"mapa-blanco_cut.png: {check_dims(map_current)}")
print(f"mapa-reduce.png: {check_dims(map_reduce)}")
