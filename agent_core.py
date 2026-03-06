import os
import time
import shutil
from expense_parser import ExpenseParser
from equipment_parser import EquipmentParser
from sheets_logger import GoogleSheetsLogger, EquipmentLogger

class ExpenseAgent:
    def __init__(self, inbox_dir="sample_receipts", archive_dir="archive_receipts"):
        self.inbox_dir = inbox_dir
        self.archive_dir = archive_dir
        self.parser = ExpenseParser()
        self.logger = GoogleSheetsLogger()
        self.equip_parser = EquipmentParser()
        self.equip_logger = EquipmentLogger()
        self._ensure_directories()

    def _ensure_directories(self):
        """Creates required directories if they don't exist."""
        os.makedirs(self.inbox_dir, exist_ok=True)
        os.makedirs(self.archive_dir, exist_ok=True)

    def process_new_receipts(self):
        """Scans the inbox folder, parses images, logs to Excel, and archives them."""
        print("Starting Expense Agent v1.0.0...")
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

    def process_single_receipt(self, file_path):
        """Parses a single image, logs to Google Sheets, and archives it. Returns (success_bool, parsed_data)."""
        file = os.path.basename(file_path)
        print(f"\n--- Processing Single Receipt: {file} ---")
        
        parsed_data = self.parser.parse_receipt(file_path)
        
        if parsed_data:
            success = self.logger.log_expense(parsed_data)
            
            if success:
                archive_path = os.path.join(self.archive_dir, file)
                try:
                    shutil.move(file_path, archive_path)
                    print(f"Archived {file} successfully.")
                except Exception as e:
                    print(f"Error archiving {file}: {e}")
                return True, parsed_data
            else:
                print(f"Failed to log data to Google Sheets for {file}.")
                return False, parsed_data
        else:
            print(f"Failed to parse {file}.")
            return False, None

    def process_single_equipment_log(self, file_path):
        """Parses an equipment logbook image, logs multiple rows to Google Sheets, and archives it."""
        file = os.path.basename(file_path)
        print(f"\n--- Processing Single Equipment Log: {file} ---")
        
        parsed_rows = self.equip_parser.parse_log(file_path)
        
        if parsed_rows:
            success = self.equip_logger.log_equipment(parsed_rows)
            
            if success:
                archive_path = os.path.join(self.archive_dir, file)
                try:
                    shutil.move(file_path, archive_path)
                    print(f"Archived {file} successfully.")
                except Exception as e:
                    print(f"Error archiving {file}: {e}")
                return True, parsed_rows
            else:
                print(f"Failed to log equipment data to Google Sheets for {file}.")
                return False, parsed_rows
        else:
            print(f"Failed to parse equipment log {file}.")
            return False, None

    def classify_image(self, file_path):
        """Uses Gemini Vision to determine if the image is a RECEIPT or an EQUIPMENT_LOG."""
        try:
            from PIL import Image
            import google.generativeai as genai
            
            # Re-using the parser's model config
            model = genai.GenerativeModel('gemini-flash-latest')
            img = Image.open(file_path)
            prompt = "Look at this image. If it is a store/restaurant receipt, reply exactly with 'RECEIPT'. If it is a handwritten logbook table (like an equipment log), reply exactly with 'EQUIPMENT_LOG'."
            
            response = model.generate_content([prompt, img])
            classification = response.text.strip().upper()
            
            if "EQUIPMENT" in classification or "LOG" in classification:
                return "EQUIPMENT_LOG"
            else:
                return "RECEIPT"
        except Exception as e:
            print(f"Classification error: {e}")
            return "RECEIPT" # Default fallback

if __name__ == "__main__":
    agent = ExpenseAgent()
    agent.process_new_receipts()
