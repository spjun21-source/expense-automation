import os
import json
import google.generativeai as genai
from PIL import Image
from dotenv import load_dotenv

class EquipmentParser:
    def __init__(self):
        load_dotenv()
        api_key = os.getenv("GEMINI_API_KEY")
        if not api_key:
            raise ValueError("GEMINI_API_KEY not found in .env file.")
        
        genai.configure(api_key=api_key)
        self.model = genai.GenerativeModel('gemini-flash-latest')
        
    def parse_log(self, image_path):
        """
        Extracts structured data from an equipment logbook image using Gemini Vision.
        Returns a list of dictionaries, where each dictionary represents a row.
        """
        try:
            img = Image.open(image_path)
            
            prompt = """
            You are a meticulous laboratory administrator. Your job is to extract data from this handwritten equipment logbook image.
            The logbook table has the following columns:
            날짜 (Date), 시간 (Time), 이름 (Name), 소속/로그인 ID (Affiliation/Login ID), 총 사용시간 (Total Usage Time), 속도 (Speed), 온도 (Temperature), 가속도 (Acceleration), 감속도 (Deceleration), 비고(사용시 특이사항) (Remarks).
            
            Return the output strictly as a JSON array of objects.
            Each object must represent a row and have the following exact keys (even if empty, provide an empty string ""):
            - "날짜"
            - "시간"
            - "이름"
            - "소속/로그인 ID"
            - "총 사용시간"
            - "속도"
            - "온도"
            - "가속도"
            - "감속도"
            - "비고"
            
            Do not include any Markdown formatting (like `json), just the raw JSON array.
            """
            
            print(f"Analyzing {os.path.basename(image_path)} as Equipment Log...")
            response = self.model.generate_content([prompt, img])
            
            try:
                raw_text = response.text
                print(f"Raw Output: {raw_text}")
            except ValueError:
                print(f"Response didn't contain text. Prompt feedback: {response.prompt_feedback}")
                return None
                
            # Clean up potential markdown formatting
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
            print(f"Error parsing logbook {image_path}: {e}")
            traceback.print_exc()
            return None

if __name__ == "__main__":
    parser = EquipmentParser()
    sample_dir = "sample_receipts"
    # To test locally if there's a file
    # files = ...
