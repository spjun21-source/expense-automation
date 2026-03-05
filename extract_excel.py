import xlrd
import json

wb = xlrd.open_workbook(r'C:\Users\spjun\OneDrive\00 EUMC Biocore\00 바이오코어\사업단 예산 관리\2025년 ER바이오코어사업단 지출내역.xls')

result = {}
for s in range(wb.nsheets):
    sheet = wb.sheet_by_index(s)
    print(f'Sheet: {sheet.name} (rows={sheet.nrows}, cols={sheet.ncols})')
    
    sheet_data = []
    for r in range(sheet.nrows):
        row_data = []
        for c in range(sheet.ncols):
            cell = sheet.cell(r, c)
            val = cell.value
            if cell.ctype == 3:
                try:
                    val = xlrd.xldate_as_datetime(val, wb.datemode).strftime('%Y-%m-%d')
                except:
                    pass
            elif cell.ctype == 2:
                if val == int(val):
                    val = int(val)
            row_data.append(str(val) if val != '' else '')
        sheet_data.append(row_data)
    
    result[sheet.name] = sheet_data
    print(f'  Total rows extracted: {len(sheet_data)}')

with open(r'C:\Users\spjun\.gemini\antigravity\scratch\expense-automation\js\expense_2025.json', 'w', encoding='utf-8') as f:
    json.dump(result, f, ensure_ascii=False, indent=2)

print(f'JSON saved ({len(sheet_data)} rows)')
