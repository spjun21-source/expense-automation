
import os

file_path = r'c:\Users\spjun\.gemini\antigravity\scratch\expense-automation\css\style.css'

with open(file_path, 'rb') as f:
    content = f.read()

# Try to find the start of the Portal Layout Override
marker = b"/* --- v5.2.29: Portal Layout Override --- */"
parts = content.split(marker)

if len(parts) > 1:
    # Keep the part BEFORE the marker (the main CSS)
    base_css = parts[0].decode('utf-8', errors='ignore')
    
    # Define the FIXED portal styles (without !important and with proper formatting)
    portal_styles = """
/* --- v5.2.29: Portal Layout Override --- */
.portal-wrapper {
  display: none; /* Initial state hidden */
  min-height: 100vh;
  background: var(--bg-dark);
}

.sidebar {
  width: 260px;
  background: rgba(10, 14, 26, 0.98);
  backdrop-filter: blur(30px);
  border-right: 1px solid var(--border);
  display: flex;
  flex-direction: column;
  position: fixed;
  top: 0;
  bottom: 0;
  z-index: 1000;
}

.sidebar-header { padding: 32px 24px; border-bottom: 1px solid var(--border); }
.sidebar-logo { font-size: 1.15rem; font-weight: 800; background: linear-gradient(135deg, #818cf8, #a78bfa); -webkit-background-clip: text; background-clip: text; -webkit-text-fill-color: transparent; }
.sidebar-version { font-size: 0.65rem; color: var(--text-dim); margin-top: 4px; font-family: 'JetBrains Mono', monospace; }

.sidebar-nav { flex: 1; padding: 20px 12px; overflow-y: auto; }
.nav-section { font-size: 0.7rem; font-weight: 600; color: var(--text-dim); text-transform: uppercase; margin: 20px 12px 10px; letter-spacing: 0.5px; }

.nav-btn {
  width: 100%; padding: 10px 14px; display: flex; align-items: center; gap: 10px;
  background: transparent; border: none; color: var(--text-muted); font-size: 0.88rem; font-weight: 500;
  border-radius: var(--radius-sm); cursor: pointer; transition: var(--transition); text-align: left; margin-bottom: 2px;
}
.nav-btn:hover { background: var(--bg-card); color: var(--text); }
.nav-btn.active { background: rgba(129, 140, 248, 0.15); color: var(--primary); }

.sidebar-footer { padding: 20px; border-top: 1px solid var(--border); }
.user-chip { display: flex; flex-direction: column; margin-bottom: 12px; }
.user-chip span { font-weight: 600; font-size: 0.9rem; }
.user-chip small { color: var(--primary); font-size: 0.7rem; }

.main-content { flex: 1; margin-left: 260px; display: flex; flex-direction: column; min-width: 0; }
.content-header { height: 72px; padding: 0 40px; display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid var(--border); background: var(--bg-dark); position: sticky; top: 0; z-index: 900; }
.content-scroller { flex: 1; padding: 32px; max-width: 1300px; width: 100%; margin: 0 auto; }

/* Dashboard layout adjust */
.dashboard { display: grid; grid-template-columns: repeat(4, 1fr) !important; gap: 16px !important; margin-bottom: 32px; }

/* Traceable Memos Styles */
.tasks-comment-area.v5-2-29 { margin-top: 32px; background: rgba(255, 255, 255, 0.05); border-radius: 12px; padding: 20px; border: 1px solid var(--border); }
.comments-timeline { display: flex; flex-direction: column; gap: 12px; margin-top: 16px; }
.comment-item { display: flex; gap: 12px; background: rgba(0, 0, 0, 0.2); padding: 12px; border-radius: 8px; border: 1px solid rgba(255,255,255,0.05); }
.comment-seq { font-family: 'JetBrains Mono', monospace; font-size: 0.8rem; color: var(--primary); font-weight: 700; }
.comment-meta { margin-top: 6px; font-size: 0.7rem; color: var(--text-dim); }
.comment-input-row { display: flex; gap: 8px; margin-top: 16px; }
.comment-input-row input { flex: 1; background: rgba(0,0,0,0.3); border: 1px solid var(--border); border-radius: 6px; padding: 8px 12px; color: var(--text); }

/* User Mgmt Table */
.usermgmt-table { width: 100%; border-collapse: collapse; margin-top: 16px; font-size: 0.85rem; }
.usermgmt-table th { text-align: left; padding: 10px; border-bottom: 1px solid var(--border); color: var(--text-dim); }
.usermgmt-table td { padding: 10px; border-bottom: 1px solid var(--border); }
"""
    
    with open(file_path, 'w', encoding='utf-8') as f:
        f.write(base_css + portal_styles)
    print("Successfully fixed style.css")
else:
    print("Error: Could not find Portal Layout Override marker")
