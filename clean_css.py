import os

css_path = r'c:\Users\spjun\.gemini\antigravity\scratch\expense-automation\css\style.css'

if os.path.exists(css_path):
    with open(css_path, 'r', encoding='utf-8') as f:
        lines = f.readlines()
    
    cleaned_lines = []
    last_line_was_empty = False
    
    for line in lines:
        stripped = line.strip()
        if not stripped:
            if not last_line_was_empty:
                cleaned_lines.append('\n')
                last_line_was_empty = True
        else:
            cleaned_lines.append(line)
            last_line_was_empty = False
            
    with open(css_path, 'w', encoding='utf-8') as f:
        f.writelines(cleaned_lines)
    
    print(f"Cleaned {len(lines)} lines down to {len(cleaned_lines)} lines.")
else:
    print("CSS file not found.")
