from PIL import Image
import os

def convert_to_ico():
    base = r"c:\Users\manba\.gemini\antigravity\scratch\sabor-de-espana"
    src = os.path.join(base, "assets", "images", "bull_launcher.png")
    dest = os.path.join(base, "assets", "images", "icon.ico")
    
    if not os.path.exists(src):
        # Check for .pgn just in case the user was literal
        src_alt = os.path.join(base, "assets", "images", "bull_launcher.pgn")
        if os.path.exists(src_alt):
            src = src_alt
        else:
            print(f"Error: Source file not found at {src}")
            return

    try:
        img = Image.open(src)
        # ICO files usually contain multiple sizes: 16, 32, 48, 64, 128, 256
        # Pillow can handle this automatically if we provide icon_sizes
        # We can also include 512 since the source is 512
        sizes = [(16,16), (32,32), (48,48), (64,64), (128,128), (256,256), (512,512)]
        img.save(dest, format='ICO', sizes=sizes)
        print(f"Successfully converted {src} to {dest}")
    except Exception as e:
        print(f"Error during conversion: {e}")

if __name__ == "__main__":
    convert_to_ico()
