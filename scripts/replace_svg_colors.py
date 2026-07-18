import os
import re

directories = ['admin-web/public', 'mobile-app/assets']

replacements = {
    re.compile(r'#FF5C00', re.IGNORECASE): '#FF5C00',
    re.compile(r'#FF5C00', re.IGNORECASE): '#E55200',
    re.compile(r'#E04F00', re.IGNORECASE): '#E55200',
    re.compile(r'#D4651A', re.IGNORECASE): '#FF5C00',
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
        for file in files:
            if file.endswith(('.svg',)):
                process_file(os.path.join(root, file))
