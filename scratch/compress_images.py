import os
from PIL import Image

folder = r"c:\Users\manba\.gemini\antigravity\scratch\sabor-de-espana\assets\images\platos"
max_size = (512, 512)

total_before = 0
total_after = 0

for filename in os.listdir(folder):
    if filename.lower().endswith('.png'):
        filepath = os.path.join(folder, filename)
        total_before += os.path.getsize(filepath)
        
        try:
            with Image.open(filepath) as img:
                img.thumbnail(max_size, Image.Resampling.LANCZOS)
                # Guardamos como PNG optimizado
                img.save(filepath, format="PNG", optimize=True)
            total_after += os.path.getsize(filepath)
            print(f"Compressed {filename}")
        except Exception as e:
            print(f"Error compressing {filename}: {e}")

print(f"Total BEFORE: {total_before / 1024 / 1024:.2f} MB")
print(f"Total AFTER: {total_after / 1024 / 1024:.2f} MB")
