import os
import re

def find_unused_images():
    workspace_root = r"c:\Users\manba\.gemini\antigravity\scratch\sabor-de-espana"
    image_extensions = ('.png', '.jpg', '.jpeg', '.gif', '.ico', '.svg', '.webp')
    
    # Files to search in
    search_dirs = [
        os.path.join(workspace_root, 'js'),
        os.path.join(workspace_root, 'css'),
        os.path.join(workspace_root, 'data'),
    ]
    search_files = [
        os.path.join(workspace_root, 'index.html'),
        os.path.join(workspace_root, 'main.js'),
    ]
    
    # Find all images
    all_images = []
    for root, dirs, files in os.walk(workspace_root):
        # Skip some directories
        if '.git' in dirs:
            dirs.remove('.git')
        if 'node_modules' in dirs:
            dirs.remove('node_modules')
        if 'dist' in dirs:
            dirs.remove('dist')
            
        for file in files:
            if file.lower().endswith(image_extensions):
                all_images.append(os.path.join(root, file))
    
    # Read all search files into a single string for efficiency
    all_content = ""
    for file_path in search_files:
        if os.path.exists(file_path):
            with open(file_path, 'r', encoding='utf-8', errors='ignore') as f:
                all_content += f.read() + "\n"
                
    for search_dir in search_dirs:
        if os.path.exists(search_dir):
            for root, dirs, files in os.walk(search_dir):
                for file in files:
                    file_path = os.path.join(root, file)
                    with open(file_path, 'r', encoding='utf-8', errors='ignore') as f:
                        all_content += f.read() + "\n"
    
    unused_images = []
    for img_path in all_images:
        img_filename = os.path.basename(img_path)
        # We search for the filename. We might need to be careful with paths if images have same names in different dirs.
        # But usually filenames are unique or the path is included.
        # Searching for the filename string is a good heuristic.
        if img_filename not in all_content:
            unused_images.append(img_path)
            
    return unused_images

if __name__ == "__main__":
    unused = find_unused_images()
    print(f"Found {len(unused)} unused images:")
    for img in sorted(unused):
        # Print relative path for readability
        rel_path = os.path.relpath(img, r"c:\Users\manba\.gemini\antigravity\scratch\sabor-de-espana")
        print(rel_path)
