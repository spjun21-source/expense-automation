import os
import gspread
from google.oauth2.service_account import Credentials
from dotenv import load_dotenv

class GoogleSheetsLogger:
    def __init__(self, credential_file="credentials.json"):
        load_dotenv()
        self.sheet_url = os.getenv("GOOGLE_SHEET_URL")
        if not self.sheet_url:
            raise ValueError("GOOGLE_SHEET_URL not found in .env file.")
        
        self.credential_file = credential_file
        
        # Define the scope for Sheets and Drive APIs
        self.scopes = [
            "https://www.googleapis.com/auth/spreadsheets",
            "https://www.googleapis.com/auth/drive"
        ]
        
        # Authenticate with Google
        self._authenticate()

    def _authenticate(self):
        """Authenticates the service account and connects to the sheet."""
        if not os.path.exists(self.credential_file):
            raise FileNotFoundError(f"Credentials file {self.credential_file} not found.")
            
        credentials = Credentials.from_service_account_file(
            self.credential_file, scopes=self.scopes
        )
        self.client = gspread.authorize(credentials)
        
        print(f"Connecting to Google Sheet...")
        spreadsheet = self.client.open_by_url(self.sheet_url)
        
        # Try to find a worksheet with a specific name, otherwise just use the first one
        target_name = "2026년 ER바이오코어사업단 지출내역"
        try:
            self.sheet = spreadsheet.worksheet(target_name)
            print(f"Connected to specific tab: {target_name}")
        except gspread.exceptions.WorksheetNotFound:
            self.sheet = spreadsheet.get_worksheet(0) # Fallback to the very first tab
            print(f"Target tab not found. Connected to the first tab: {self.sheet.title}")

    def log_expense(self, parsed_data):
        """
        Appends the parsed JSON data to the Google Sheet.
        Expects columns to match: NO, 지출예정일자, 지출내역, 지출금액, 지급처, 
        입금은행명, 입금계좌, 처리유형, 재원, 지출비목, 세목, 구입처, 문서번호
        """
        if not parsed_data:
            print("Warning: Received empty data to log.")
            return False

        try:
            # Get all existing values to figure out the next "NO"
            records = self.sheet.get_all_records()
            next_no = 1
            if records:
                try:
                    max_no = max(int(row.get('NO', 0) if str(row.get('NO', '')).isdigit() else 0) for row in records)
                    next_no = max_no + 1
                except ValueError:
                    next_no = len(records) + 1

            # Prepare the row data precisely mapped to the Korean columns order
            # NO | 지출예정일자 | 지출내역 | 지출금액 | 지급처 | 입금은행명 | 입금계좌 | 처리유형 | 재원 | 지출비목 | 세목 | 구입처 | 문서번호
            new_row = [
                next_no,
                parsed_data.get("지출예정일자", ""),
                parsed_data.get("지출내역", ""),
                str(parsed_data.get("지출금액", "")),
                "", # 지급처
                "", # 입금은행명
                "", # 입금계좌
                "", # 처리유형
                "", # 재원
                "", # 지출비목
                "", # 세목
                parsed_data.get("구입처", ""),
                ""  # 문서번호
            ]
            
            # Append the row
            self.sheet.append_row(new_row, value_input_option='USER_ENTERED')
            print(f"Successfully logged expense from {parsed_data.get('구입처', 'Unknown')} to Google Sheets.")
            return True
            
        except Exception as e:
            print(f"Error logging to Google Sheets: {e}")
            return False

if __name__ == "__main__":
    # Ensure URL is set before testing
    logger = GoogleSheetsLogger()
    test_data = {
        "지출예정일자": "20260304",
        "지출내역": "API Test Expense",
        "지출금액": 15000,
        "구입처": "테스트 커피"
    }
    logger.log_expense(test_data)
