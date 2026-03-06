import os
import time
import json
import logging
from dotenv import load_dotenv
from telegram import Update
from telegram.ext import ApplicationBuilder, CommandHandler, MessageHandler, filters, ContextTypes
from agent_core import ExpenseAgent

# Setup logging
logging.basicConfig(
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    level=logging.INFO
)
logger = logging.getLogger(__name__)

# Load environment variables
load_dotenv()
TOKEN = os.getenv("TELEGRAM_BOT_TOKEN")
ALLOWED_USERS_STR = os.getenv("ALLOWED_TELEGRAM_USERS", "")
ALLOWED_USERS = [int(u.strip()) for u in ALLOWED_USERS_STR.split(",") if u.strip().isdigit()]

agent = ExpenseAgent()

def is_authorized(user_id: int) -> bool:
    if not ALLOWED_USERS:
        return True # If not configured, allow anyone (for initial setup)
    return user_id in ALLOWED_USERS

async def start(update: Update, context: ContextTypes.DEFAULT_TYPE):
    user_id = update.effective_user.id
    if not is_authorized(user_id):
        logger.warning(f"Unauthorized access attempt by {user_id}")
        await update.message.reply_text("Sorry, you are not authorized to use this bot.")
        return
        
    welcome_text = (
        "Welcome to the Expense Automation Bot! 🚀\n\n"
        f"Your Telegram ID is: `{user_id}`\n\n"
        "Send me a clear photo of a receipt or an equipment logbook.\n"
        "Optional: Add caption 'receipt' or 'log' to bypass AI classification."
    )
    await update.message.reply_markdown(welcome_text)

async def handle_photo(update: Update, context: ContextTypes.DEFAULT_TYPE):
    user_id = update.effective_user.id
    if not is_authorized(user_id):
        await update.message.reply_text("Unauthorized.")
        return

    # Acknowledge receipt
    message = await update.message.reply_text("📸 Photo received! Processing receipt with Gemini Vision...")

    try:
        # Get the largest available size of the photo
        photo_file = await update.message.photo[-1].get_file()
        
        # Download locally
        timestamp = int(time.time())
        file_name = f"tg_receipt_{timestamp}.jpg"
        file_path = os.path.join(agent.inbox_dir, file_name)
        
        await photo_file.download_to_drive(custom_path=file_path)
        logger.info(f"Downloaded image from user {user_id} to {file_path}")

        caption = update.message.caption
        if caption and "log" in caption.lower():
            form_type = "EQUIPMENT_LOG"
        elif caption and "receipt" in caption.lower():
            form_type = "RECEIPT"
        else:
            await message.edit_text("📸 Validating image type with AI...")
            form_type = agent.classify_image(file_path)
            await message.edit_text(f"📸 Image classified as: <b>{form_type}</b>. Processing...", parse_mode='HTML')

        if form_type == "EQUIPMENT_LOG":
            success, parsed_data = agent.process_single_equipment_log(file_path)
            if success:
                response = (
                    f"✅ <b>Equipment Log Successfully Processed!</b>\n\n"
                    f"Logged <b>{len(parsed_data)}</b> rows to Google Sheets.\n"
                    "The image has been archived."
                )
            else:
                response = "❌ <b>Failed to parse or log the equipment log.</b>"
            await message.edit_text(response, parse_mode='HTML')
            
        else:
            # Process as receipt
            success, parsed_data = agent.process_single_receipt(file_path)
    
            if success:
                response = (
                    "✅ <b>Successfully processed and logged to Google Sheets!</b>\n\n"
                    f"📅 <b>Date:</b> {parsed_data.get('지출예정일자', 'N/A')}\n"
                    f"🏬 <b>Vendor:</b> {parsed_data.get('구입처', 'N/A')}\n"
                    f"💰 <b>Amount:</b> {parsed_data.get('지출금액', 'N/A')} 원\n"
                    f"📝 <b>Summary:</b> {parsed_data.get('지출내역', 'N/A')}\n\n"
                    "The image has been archived."
                )
                await message.edit_text(response, parse_mode='HTML')
            else:
                if parsed_data:
                    response = (
                        "⚠️ <b>Error logging to Google Sheets!</b>\n\n"
                        "Data was correctly parsed:\n"
                        f"<pre><code class=\"language-json\">\n{json.dumps(parsed_data, indent=2, ensure_ascii=False)}\n</code></pre>\n"
                        "Please check your Google Sheets connection."
                    )
                else:
                    response = "❌ <b>Failed to parse the receipt.</b> Please ensure the image is clear and contains a valid receipt."
                await message.edit_text(response, parse_mode='HTML')

    except Exception as e:
        logger.error(f"Error handling photo: {e}", exc_info=True)
        await message.edit_text(f"❌ An error occurred while processing the photo:\n<code>{str(e)}</code>", parse_mode='HTML')

if __name__ == '__main__':
    if not TOKEN:
        logger.error("TELEGRAM_BOT_TOKEN not found in .env")
        exit(1)
        
    logger.info("Starting Telegram Bot...")
    application = ApplicationBuilder().token(TOKEN).build()
    
    application.add_handler(CommandHandler('start', start))
    application.add_handler(MessageHandler(filters.PHOTO, handle_photo))
    
    # Run the bot until the user presses Ctrl-C
    application.run_polling()
