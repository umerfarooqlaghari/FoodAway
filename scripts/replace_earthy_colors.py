import os
import re

directories = ['admin-web', 'backend', 'mobile-app']

replacements = {
    re.compile(r'#F5F3EE', re.IGNORECASE): '#FFFFFF',
    re.compile(r'#1A1208', re.IGNORECASE): '#111827',
    re.compile(r'#6B5340', re.IGNORECASE): '#4B5563',
    re.compile(r'#8B6B4A', re.IGNORECASE): '#9CA3AF',
    re.compile(r'#4A3520', re.IGNORECASE): '#374151',
    re.compile(r'#5C3D22', re.IGNORECASE): '#374151',
    re.compile(r'245,\s*243,\s*238', re.IGNORECASE): '255, 255, 255',
    re.compile(r'30,\s*20,\s*10', re.IGNORECASE): '17, 24, 39',
    re.compile(r'26,\s*18,\s*8', re.IGNORECASE): '17, 24, 39',
    re.compile(r'#F5E2C0', re.IGNORECASE): '#FFFFFF', # brand-orange-light
    re.compile(r'#8A3D0A', re.IGNORECASE): '#CC4A00', # brand-orange-dark
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
            if file.endswith(('.js', '.jsx', '.ts', '.tsx', '.css', '.html', '.json', '.md', '.svg')):
                process_file(os.path.join(root, file))
