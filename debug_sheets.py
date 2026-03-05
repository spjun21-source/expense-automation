import os, gspread
from google.oauth2.service_account import Credentials
from dotenv import load_dotenv

load_dotenv()
url = os.getenv("GOOGLE_SHEET_URL")

creds = Credentials.from_service_account_file(
    "credentials.json",
    scopes=["https://www.googleapis.com/auth/spreadsheets", "https://www.googleapis.com/auth/drive"]
)
client = gspread.authorize(creds)
spreadsheet = client.open_by_url(url)

print(f"Spreadsheet: {spreadsheet.title}")
print(f"Total worksheets: {len(spreadsheet.worksheets())}")

for ws in spreadsheet.worksheets():
    print(f"\n=== Tab: '{ws.title}' (gid={ws.id}) ===")
    all_vals = ws.get_all_values()
    print(f"Total rows: {len(all_vals)}")
    for i, row in enumerate(all_vals):
        print(f"  Row {i}: {row}")
