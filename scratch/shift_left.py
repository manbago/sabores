import json
import os
import shutil

base = r"c:\Users\manba\.gemini\antigravity\scratch\sabor-de-espana"
json_path = os.path.join(base, "data", "provincesData.json")
bak_path = json_path + ".bak"

# Restore from backup first
if os.path.exists(bak_path):
    with open(bak_path, 'r', encoding='utf-8') as f:
        data = json.load(f)
        
    # Subtract 231 (the opposite of what we did before)
    for p in data:
        p['x'] = p['x'] - 231

    with open(json_path, 'w', encoding='utf-8') as f:
        json.dump(data, f, ensure_ascii=False, indent=4)
    print("Coordinates shifted left by 231 (using backup).")
else:
    print("Backup not found!")
