# Expense Automation Core v1.0.0

This project automates the extraction and logging of expense receipts into Google Sheets.

## Architecture

1. **`expense_parser.py`**: Uses Google Gemini Vision API (`gemini-flash-latest`) to read receipt images and extract structural JSON data (`지출예정일자`, `지출내역`, `지출금액`, `구입처`).
2. **`sheets_logger.py`**: Connects via a Google Service Account (`credentials.json`) to the specified Google Sheet URL and appends the parsed data to the `2026년 ER바이오코어사업단 지출내역` tab according to the exact Korean column format.
3. **`agent_core.py`**: The main orchestrator that monitors the `sample_receipts/` directory. For every image found, it parses, logs it to Google Sheets, and moves the processed image to `archive_receipts/` to avoid duplication.
4. **`local_logger.py`**: A fallback module used during development for writing to local `.xlsx` files.

## Setup Instructions

1. Retrieve the Google Cloud Service Account `credentials.json` (ensure this is in the project root; it is ignored by Git).
2. Configure `.env`:
   ```env
   GEMINI_API_KEY="your_gemini_api_key_here"
   GOOGLE_SHEET_URL="https://docs.google.com/spreadsheets/d/your_sheet_id/edit"
   ```
3. Run `venv\Scripts\python agent_core.py` to process receipts in the `sample_receipts/` folder.
