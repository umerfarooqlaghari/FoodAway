import os
import re

directories = ['admin-web', 'backend', 'mobile-app']

replacements = {
    re.compile(r'#FF5C00', re.IGNORECASE): '#FF5C00',
    re.compile(r'#FF5C00', re.IGNORECASE): '#E55200',
    re.compile(r'#E04F00', re.IGNORECASE): '#E55200',
    re.compile(r'#D4651A', re.IGNORECASE): '#FF5C00',
    re.compile(r'255,\s*90,\s*0', re.IGNORECASE): '226, 122, 83',
    re.compile(r'212,\s*101,\s*26', re.IGNORECASE): '226, 122, 83',
}

def process_file(filepath):
    try:
        with open(filepath, 'r', encoding='utf-8') as f:
            content = f.read()
    except UnicodeDecodeError:
        return

    new_content = content
    for pattern, replacement in replacements.items():
        new_content = pattern.sub(replacement, new_content)

    if new_content != content:
        with open(filepath, 'w', encoding='utf-8') as f:
            f.write(new_content)
        print(f'Updated {filepath}')

for d in directories:
    for root, dirs, files in os.walk(d):
        if 'node_modules' in root or '.git' in root or '.expo' in root or 'build' in root or 'dist' in root:
            continue
        for file in files:
            if file.endswith(('.js', '.jsx', '.ts', '.tsx', '.css', '.html', '.json', '.md')):
                process_file(os.path.join(root, file))
