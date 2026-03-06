# Expense & Equipment Automation Core v1.1.0

This project automates the extraction and logging of paperwork (expense receipts and equipment logbooks) directly into Google Sheets using AI.

## Architecture

1. **`telegram_bot.py`**: The main user interface. A Telegram bot (`@ERbio_bot`) that listens for photo uploads. It authenticates users against a whitelist (`ALLOWED_TELEGRAM_USERS`), downloads the images, uses AI to classify what type of form it is, and routes it to the correct parser.
2. **`expense_parser.py`**: Uses Google Gemini Vision API (`gemini-flash-latest`) to read receipt images and extract structured JSON data (`지출예정일자`, `지출내역`, `지출금액`, `구입처`).
3. **`equipment_parser.py`**: Uses Gemini Vision to read handwritten equipment logbooks and extract an array of row data (`날짜`, `시간`, `이름`, `소속/로그인 ID`, `총 사용시간`, `속도`, `온도`, `가속도`, `감속도`, `비고`).
4. **`sheets_logger.py`**: Connects via a Google Service Account (`credentials.json`) to the specified Google Sheet URLs. Contains two loggers:
   - `GoogleSheetsLogger`: Appends to the `2026년 ER바이오코어사업단 지출내역` tab according to the exact Korean column format.
   - `EquipmentLogger`: Appends multiple rows to the `log book` tab.
5. **`agent_core.py`**: The core orchestrator (`ExpenseAgent`). It handles the logic of calling the parsers, passing data to the loggers, and moving the successfully processed image to `archive_receipts/`.

## Setup Instructions

1. Retrieve the Google Cloud Service Account `credentials.json` (ensure this is in the project root).
2. Share your target Google Sheets with the service account email found inside `credentials.json` with "Editor" permissions.
3. Configure `.env`:
   ```env
   GEMINI_API_KEY="your_gemini_api_key_here"
   TELEGRAM_BOT_TOKEN="your_telegram_bot_token"
   ALLOWED_TELEGRAM_USERS="123456789,987654321" # Comma-separated Telegram User IDs
   GOOGLE_SHEET_URL="https://docs.google.com/spreadsheets/d/your_expense_sheet_id/edit"
   EQUIPMENT_SHEET_URL="https://docs.google.com/spreadsheets/d/your_equipment_sheet_id/edit"
   ```
4. Run the bot:
   ```bash
   venv\Scripts\python telegram_bot.py
   ```

## Usage
- Open Telegram and search for your configured bot.
- Send `/start` to get your User ID (add this ID to `ALLOWED_TELEGRAM_USERS` in `.env` and restart the bot).
- Send a photo of a receipt or logbook. The bot will automatically classify it.
- **Optional Bypass**: Add the caption `receipt` or `log` when sending the photo to skip AI classification and process slightly faster.
