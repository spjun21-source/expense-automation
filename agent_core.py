import os
import time
import shutil
from expense_parser import ExpenseParser
from sheets_logger import GoogleSheetsLogger

class ExpenseAgent:
    def __init__(self, inbox_dir="sample_receipts", archive_dir="archive_receipts"):
        self.inbox_dir = inbox_dir
        self.archive_dir = archive_dir
        self.parser = ExpenseParser()
        self.logger = GoogleSheetsLogger()
        self._ensure_directories()

    def _ensure_directories(self):
        """Creates required directories if they don't exist."""
        os.makedirs(self.inbox_dir, exist_ok=True)
        os.makedirs(self.archive_dir, exist_ok=True)

    def process_new_receipts(self):
        """Scans the inbox folder, parses images, logs to Excel, and archives them."""
        files = [f for f in os.listdir(self.inbox_dir) if f.lower().endswith(('.png', '.jpg', '.jpeg', '.pdf'))]
        
        if not files:
            print("No new receipts found.")
            return

        print(f"[{time.strftime('%Y-%m-%d %H:%M:%S')}] Found {len(files)} new receipt(s) to process.")
        
        for file in files:
            file_path = os.path.join(self.inbox_dir, file)
            print(f"\n--- Processing {file} ---")
            
            # Step 1: Parse the receipt with Gemini Vision
            parsed_data = self.parser.parse_receipt(file_path)
            
            if parsed_data:
                # Step 2: Log the extracted data to Excel
                success = self.logger.log_expense(parsed_data)
                
                if success:
                    # Step 3: Move the file to the archive to prevent duplicate processing
                    archive_path = os.path.join(self.archive_dir, file)
                    try:
                        shutil.move(file_path, archive_path)
                        print(f"Archived {file} successfully.")
                    except Exception as e:
                        print(f"Error archiving {file}: {e}")
                else:
                    print(f"Failed to log data for {file}. File remains in inbox.")
            else:
                print(f"Failed to parse {file}. File remains in inbox for review.")

if __name__ == "__main__":
    agent = ExpenseAgent()
    agent.process_new_receipts()
