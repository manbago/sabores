import json
import os

base = r"c:\Users\manba\.gemini\antigravity\scratch\sabor-de-espana"
json_path = os.path.join(base, "data", "provincesData.json")

with open(json_path, 'r', encoding='utf-8') as f:
    data = json.load(f)
    
for p in data:
    p['x'] = p['x'] - 462

with open(json_path, 'w', encoding='utf-8') as f:
    json.dump(data, f, ensure_ascii=False, indent=4)
print("Coordinates shifted left by 462.")
