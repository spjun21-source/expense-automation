
import os

file_path = r'c:\Users\spjun\.gemini\antigravity\scratch\expense-automation\css\style.css'

try:
    # Try reading as UTF-16
    with open(file_path, 'rb') as f:
        content = f.read()
    
    # Check for UTF-16 BE or LE BOM
    if content.startswith(b'\xff\xfe') or content.startswith(b'\xfe\xff'):
        text = content.decode('utf-16')
    else:
        # Fallback to UTF-8 if it was already UTF-8
        text = content.decode('utf-8', errors='ignore')

    # Fix the space-separated characters if they persist in the decoded string
    # (Sometimes echo adds null bytes or something)
    text = text.replace('\x00', '')

    with open(file_path, 'w', encoding='utf-8') as f:
        f.write(text)
    print("Successfully converted style.css to UTF-8")
except Exception as e:
    print(f"Error: {e}")
