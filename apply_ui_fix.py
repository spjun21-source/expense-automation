import re
import os

css_path = r'c:\Users\spjun\.gemini\antigravity\scratch\expense-automation\css\style.css'

with open(css_path, 'r', encoding='utf-8') as f:
    content = f.read()

# 1. Update main .dashboard block
# Note: Using [\s\n]* to account for the weird spacing
dashboard_pattern = r'\.dashboard\s*{\s*display: grid;[\s\n]*grid-template-columns: repeat\(2, 1fr\);[\s\n]*gap: 12px;[\s\n]*}'
dashboard_replacement = """.dashboard {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  margin-bottom: 24px;
}"""

content = re.sub(dashboard_pattern, dashboard_replacement, content)

# 2. Update .stat-card and its hover
stat_card_pattern = r'\.stat-card\s*{[^}]*box-shadow: var\(--shadow\);[\s\n]*}[\s\n]*\.stat-card:hover\s*{[^}]*box-shadow: var\(--shadow\);[\s\n]*}'
stat_card_replacement = """.stat-card {
  flex: 1;
  min-width: 140px;
  background: var(--bg-glass);
  backdrop-filter: var(--glass-blur);
  -webkit-backdrop-filter: var(--glass-blur);
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  padding: 10px 16px;
  text-align: center;
  transition: var(--transition);
  display: flex;
  align-items: center;
  gap: 10px;
}
.stat-card:hover { border-color: var(--primary); transform: translateY(-1px); }"""

content = re.sub(stat_card_pattern, stat_card_replacement, content)

# 3. Update the value, label, icon styles (they are separate in CSS)
content = re.sub(r'\.stat-icon\s*{\s*font-size: 1\.8rem;[\s\n]*margin-bottom: 8px;[\s\n]*}', r'.stat-icon { font-size: 1.2rem; }', content)
content = re.sub(r'\.stat-value\s*{\s*font-size: 1\.6rem;[\s\n]*font-weight: 700;[\s\n]*color: var\(--primary\);[\s\n]*font-family: \'JetBrains Mono\', monospace;[\s\n]*}', r'.stat-value { font-size: 1.1rem; font-weight: 700; color: var(--primary); font-family: \'JetBrains Mono\', monospace; }', content)
content = re.sub(r'\.stat-label\s*{\s*font-size: 0\.78rem;[\s\n]*color: var\(--text-muted\);[\s\n]*margin-top: 4px;[\s\n]*}', r'.stat-label { font-size: 0.75rem; color: var(--text-muted); margin-top: 0; }', content)

# 4. Update .dashboard-area
area_pattern = r'\.dashboard-area\s*{\s*max-width: 1200px;[\s\n]*margin: 24px auto;[\s\n]*padding: 0 32px;[\s\n]*display: grid;[\s\n]*grid-template-columns: 1fr 1fr;[\s\n]*gap: 20px;[\s\n]*align-items: start;[\s\n]*}'
area_replacement = """.dashboard-area {
  max-width: 1300px;
  margin: 16px auto 32px;
  padding: 0 32px;
  display: flex;
  flex-direction: column;
  gap: 20px;
}"""

content = re.sub(area_pattern, area_replacement, content)

with open(css_path, 'w', encoding='utf-8') as f:
    f.write(content)

print("UI Optimization applied successfully.")
