
import os
import re

def check_files():
    src_dir = 'src'
    pattern_use = re.compile(r'<Button\b')
    pattern_import = re.compile(r'import.*Button.*from')
    
    for root, dirs, files in os.walk(src_dir):
        for file in files:
            if file.endswith('.tsx'):
                path = os.path.join(root, file)
                with open(path, 'r', encoding='utf-8') as f:
                    content = f.read()
                    if pattern_use.search(content) and not pattern_import.search(content):
                        print(f"Missing import in: {path}")

if __name__ == "__main__":
    check_files()
