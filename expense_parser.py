import os
import json
import google.generativeai as genai
from PIL import Image
from dotenv import load_dotenv

class ExpenseParser:
    def __init__(self):
        load_dotenv()
        api_key = os.getenv("GEMINI_API_KEY")
        if not api_key:
            raise ValueError("GEMINI_API_KEY not found in .env file.")
        
        genai.configure(api_key=api_key)
        # Using gemini-flash-latest as verified by the API availability list
        self.model = genai.GenerativeModel('gemini-flash-latest')
        
    def parse_receipt(self, image_path):
        """
        Extracts structured data from a receipt image using Gemini Vision.
        """
        try:
            img = Image.open(image_path)
            
            prompt = """
            You are a meticulous corporate accountant. Your job is to extract data from this receipt image.
            Return the output strictly as a JSON object with the following fields:
            - "지출예정일자": The date of the transaction (Format: YYYYMMDD, e.g. 20260304). If day is not available, use 01.
            - "지출내역": Summary of the items purchased or the nature of the expense.
            - "지출금액": The total amount paid as a number (no currency symbols, just the integer/float).
            - "구입처": The name of the store, vendor, or company.
            
            Do not include any Markdown formatting (like `json), just the raw JSON object.
            """
            
            print(f"Analyzing {os.path.basename(image_path)}...")
            response = self.model.generate_content([prompt, img])
            
            try:
                raw_text = response.text
                print(f"Raw Output: {raw_text}")
            except ValueError:
                print(f"Response didn't contain text. Prompt feedback: {response.prompt_feedback}")
                return None
                
            # Clean up potential markdown formatting if the model still includes it
            cleaned_text = raw_text.strip()
            if cleaned_text.startswith('```json'):
                cleaned_text = cleaned_text[7:]
            if cleaned_text.startswith('```'):
                cleaned_text = cleaned_text[3:]
            if cleaned_text.endswith('```'):
                cleaned_text = cleaned_text[:-3]
            
            cleaned_text = cleaned_text.strip()
            
            return json.loads(cleaned_text)
            
        except Exception as e:
            import traceback
            print(f"Error parsing receipt {image_path}: {e}")
            traceback.print_exc()
            return None

if __name__ == "__main__":
    parser = ExpenseParser()
    sample_dir = "sample_receipts"
    
    if os.path.exists(sample_dir):
        files = [f for f in os.listdir(sample_dir) if f.lower().endswith(('.png', '.jpg', '.jpeg', '.pdf'))]
        if not files:
            print(f"No image files found in {sample_dir}")
        else:
            for file in files:
                file_path = os.path.join(sample_dir, file)
                result = parser.parse_receipt(file_path)
                print(f"Result for {file}:")
                print(json.dumps(result, indent=2, ensure_ascii=False))
                print("-" * 40)
    else:
        print(f"Directory {sample_dir} not found.")
