import pandas as pd
import os
from datetime import datetime

class LocalDataLogger:
    def __init__(self, file_path="expense_log_custom.xlsx"):
        self.file_path = file_path
        self.columns = [
            "NO", "지출예정일자", "지출내역", "지출금액", "지급처", 
            "입금은행명", "입금계좌", "처리유형", "재원", 
            "지출비목", "세목", "구입처", "문서번호"
        ]
        self._initialize_file()

    def _initialize_file(self):
        """Creates the Excel file with headers if it doesn't exist."""
        if not os.path.exists(self.file_path):
            df = pd.DataFrame(columns=self.columns)
            df.to_excel(self.file_path, index=False)
            print(f"Created new Excel log file: {self.file_path}")

    def log_expense(self, parsed_data):
        """
        Appends the parsed JSON data to the Excel file matching the specific requested structure.
        """
        if not parsed_data:
            print("Warning: Received empty data to log.")
            return False

        try:
            # Load existing data first
            df = pd.read_excel(self.file_path)
            
            # Determine the next NO
            next_no = 1
            if not df.empty and "NO" in df.columns:
                # Fill NaNs with 0 to safely get max
                max_no = pd.to_numeric(df["NO"], errors='coerce').fillna(0).max()
                next_no = int(max_no) + 1
            
            # Map the JSON keys to the specific Korean Excel columns
            new_row = {
                "NO": next_no,
                "지출예정일자": parsed_data.get("지출예정일자", ""),
                "지출내역": parsed_data.get("지출내역", ""),
                "지출금액": parsed_data.get("지출금액", ""),
                "지급처": "", # Leave empty for now, or user can edit
                "입금은행명": "",
                "입금계좌": "",
                "처리유형": "",
                "재원": "",
                "지출비목": "",
                "세목": "",
                "구입처": parsed_data.get("구입처", ""),
                "문서번호": ""
            }
            
            # Create a new DataFrame for the new row and concat
            new_df = pd.DataFrame([new_row])
            df = pd.concat([df, new_df], ignore_index=True)
            
            df.to_excel(self.file_path, index=False)
            print(f"Successfully logged expense from {new_row['구입처']} to {self.file_path}")
            return True
        except Exception as e:
            print(f"Error logging to Excel: {e}")
            return False

if __name__ == "__main__":
    # Test the logger
    logger = LocalDataLogger("test_expense_log_custom.xlsx")
    test_data = {
        "지출예정일자": "20260304",
        "지출내역": "명함제작(이은지 연구원)",
        "지출금액": 22000,
        "구입처": "한기원"
    }
    logger.log_expense(test_data)
