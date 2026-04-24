from PIL import Image
import os

def check_dims(path):
    try:
        with Image.open(path) as img:
            return img.size
    except Exception as e:
        return str(e)

base = r"c:\Users\manba\.gemini\antigravity\scratch\sabor-de-espana"
bull = os.path.join(base, "assets", "images", "bull_launcher.png")
icon = os.path.join(base, "assets", "images", "icon.ico")

print(f"bull_launcher.png: {check_dims(bull)}")
print(f"icon.ico: {check_dims(icon)}")
