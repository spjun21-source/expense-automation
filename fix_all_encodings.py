
import os
import sys

# Windows console encoding fix
if sys.platform == 'win32':
    import io
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

def fix_file(path):
    try:
        with open(path, 'rb') as f:
            content = f.read()
        
        # Detect UTF-16 LE/BE
        if content.startswith(b'\xff\xfe') or content.startswith(b'\xfe\xff'):
            text = content.decode('utf-16')
            print(f"Decoded {path} as UTF-16")
        else:
            # Fallback to UTF-8
            text = content.decode('utf-8', errors='ignore')
            if '\x00' in text:
                text = text.replace('\x00', '')
                print(f"Stripped null bytes from {path}")

        # Ensure we write proper UTF-8
        with open(path, 'w', encoding='utf-8', newline='\n') as f:
            f.write(text)
        print(f"SUCCESS: Normalized {path} to UTF-8")
    except Exception as e:
        print(f"ERROR: Failed to fix {path}: {e}")

# Target files
files_to_fix = [
    r'js/app.js',
    r'js/auth.js',
    r'js/data.js',
    r'js/supabase.js',
    r'js/store.js',
    r'js/tasks.js',
    r'js/forms.js',
    r'js/tutorial.js',
    r'js/approval.js',
    r'css/style.css'
]

base_dir = r'c:\Users\spjun\.gemini\antigravity\scratch\expense-automation'

for f in files_to_fix:
    full_path = os.path.join(base_dir, f)
    if os.path.exists(full_path):
        fix_file(full_path)
    else:
        print(f"WARNING: File not found: {full_path}")
print("--- Done ---")
