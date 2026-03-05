import re
import os

css_path = r'c:\Users\spjun\.gemini\antigravity\scratch\expense-automation\css\style.css'

with open(css_path, 'r', encoding='utf-8') as f:
    content = f.read()

# Remove any remaining .dashboard grid blocks and replace with flex
content = re.sub(r'\.dashboard\s*{\s*display: grid;[\s\n]*grid-template-columns: repeat\(\d, 1fr\)\s*(!important)?;[\s\n]*gap: \d+px\s*(!important)?;[\s\n]*margin-bottom: \d+px;[\s\n]*}', 
                 r'.dashboard { display: flex !important; flex-wrap: wrap !important; gap: 12px; margin-bottom: 24px; }', content)

# Remove redundant dashboard area if needed or ensure it's flex
content = re.sub(r'\.dashboard\s*{\s*display: grid;[\s\n]*grid-template-columns: repeat\(2, 1fr\);[\s\n]*gap: 12px;[\s\n]*}',
                 r'.dashboard { display: flex; flex-wrap: wrap; gap: 12px; margin-bottom: 24px; }', content)

# Clean up any residual empty blocks or redundant declarations
content = re.sub(r'\n\s*\n\s*\n', '\n\n', content)

with open(css_path, 'w', encoding='utf-8') as f:
    f.write(content)

print("Final CSS cleanup completed.")
