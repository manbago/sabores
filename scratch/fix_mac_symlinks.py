import os
import shutil
from pathlib import Path

def flatten_symlinks(root_dir):
    print(f"Starting to flatten symlinks in: {root_dir}")
    total_count = 0
    
    # We use os.walk but we need to handle links carefully
    # We'll do multiple passes to handle links to links
    for pass_num in range(1, 10):
        count = 0
        links_to_process = []
        
        # Find all actual links on disk
        for root, dirs, files in os.walk(root_dir):
            for item in dirs + files:
                full_path = os.path.join(root, item)
                if os.path.islink(full_path):
                    links_to_process.append(full_path)
        
        if not links_to_process:
            print(f"Pass {pass_num}: No more links found.")
            break
            
        print(f"Pass {pass_num}: Found {len(links_to_process)} links.")
        
        for link_path in links_to_process:
            try:
                # Read the link target
                target_str = os.readlink(link_path)
                # Resolve relative target against the link's directory
                link_dir = os.path.dirname(link_path)
                target_path = os.path.normpath(os.path.join(link_dir, target_str))
                
                print(f"Processing: {os.path.relpath(link_path, root_dir)} -> {target_path}")
                
                if not os.path.exists(target_path):
                    print(f"  Warning: Target does not exist: {target_path}. Deleting broken link.")
                    os.unlink(link_path)
                    continue

                # It's a valid target. Determine if it's a dir or file
                is_dir = os.path.isdir(target_path)
                
                # Delete the link
                os.unlink(link_path)
                
                # Copy the real content
                if is_dir:
                    shutil.copytree(target_path, link_path, symlinks=False)
                else:
                    shutil.copy2(target_path, link_path)
                
                count += 1
                total_count += 1
            except Exception as e:
                print(f"  Error processing {link_path}: {e}")
        
        print(f"Pass {pass_num} finished. Flattened {count} links.")

    print(f"Total symlinks flattened across all passes: {total_count}")

if __name__ == "__main__":
    target_dir = os.path.join(os.getcwd(), "dist", "steam_mac")
    if os.path.exists(target_dir):
        flatten_symlinks(target_dir)
    else:
        print(f"Error: Directory not found: {target_dir}")
