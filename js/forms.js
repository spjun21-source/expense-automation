// ============================================================
// 사업단 경비 처리 자동화 - Forms Module (v2 - Excel Export)
// ============================================================

import { FORM_FIELDS, EXCEL_COLUMNS } from './data.js';

class FormManager {
  constructor() {
    this.currentFormType = 'expense_resolution';
    this.formData = {};
    this.generatedDocs = 0;
    this.loadDocCount();
  }

  loadDocCount() {
    try { this.generatedDocs = parseInt(localStorage.getItem('expense_doc_count') || '0'); } catch (e) { }
  }
  saveDocCount() { localStorage.setItem('expense_doc_count', String(this.generatedDocs)); }

  setFormType(type) { this.currentFormType = type; this.formData = {}; }

  renderForm(container) {
    const formDef = FORM_FIELDS[this.currentFormType];
    if (!formDef || !container) return;
    container.innerHTML = '';
    const formEl = document.createElement('div');
    formEl.className = 'form-container';

    formDef.fields.forEach(field => {
      const group = document.createElement('div');
      group.className = 'form-group';
      if (field.type === 'checklist') {
        group.innerHTML = `<label class="form-label">${field.label}</label>
          <div class="form-checkbox-group" id="field_${field.id}">
            ${field.items.map((item, i) => `<label class="form-checkbox-item"><input type="checkbox" value="${item}" data-field="${field.id}"><span>${item}</span></label>`).join('')}
          </div>`;
      } else {
        group.innerHTML = `<label class="form-label">${field.label}${field.required ? '<span class="required">*</span>' : ''}</label>
          ${this.renderFieldInput(field)}
          <div class="form-validation" id="val_${field.id}"></div>`;
      }
      formEl.appendChild(group);
    });
    container.appendChild(formEl);
    this.bindFormEvents(container);
  }

  renderFieldInput(field) {
    switch (field.type) {
      case 'text': return `<input class="form-input" type="text" id="field_${field.id}" placeholder="${field.placeholder || ''}" data-field="${field.id}">`;
      case 'number': return `<input class="form-input" type="number" id="field_${field.id}" placeholder="0" data-field="${field.id}">`;
      case 'date':
        const today = new Date().toISOString().split('T')[0];
        return `<input class="form-input" type="date" id="field_${field.id}" value="${today}" data-field="${field.id}">`;
      case 'textarea': return `<textarea class="form-textarea" id="field_${field.id}" placeholder="${field.placeholder || ''}" data-field="${field.id}"></textarea>`;
      case 'select': return `<select class="form-select" id="field_${field.id}" data-field="${field.id}"><option value="">선택하세요</option>${field.options.map(o => `<option value="${o}">${o}</option>`).join('')}</select>`;
      default: return `<input class="form-input" type="text" id="field_${field.id}" data-field="${field.id}">`;
    }
  }

  bindFormEvents(container) {
    container.querySelectorAll('.form-input, .form-textarea, .form-select').forEach(el => {
      const handler = (e) => { if (e.target.dataset.field) this.formData[e.target.dataset.field] = e.target.value; };
      el.addEventListener('change', handler);
      el.addEventListener('input', handler);
    });
    container.querySelectorAll('input[type="checkbox"]').forEach(el => {
      el.addEventListener('change', (e) => {
        const label = e.target.closest('.form-checkbox-item');
        if (label) label.classList.toggle('checked', e.target.checked);
      });
    });
  }

  collectFormData() {
    const formDef = FORM_FIELDS[this.currentFormType];
    const data = {};
    formDef.fields.forEach(field => {
      if (field.type === 'checklist') {
        data[field.id] = [];
        document.querySelectorAll(`#field_${field.id} input[type="checkbox"]`).forEach(cb => {
          if (cb.checked) data[field.id].push(cb.value);
        });
      } else {
        const el = document.getElementById(`field_${field.id}`);
        if (el) data[field.id] = el.value;
      }
    });
    return data;
  }

  validateForm() {
    const formDef = FORM_FIELDS[this.currentFormType];
    const data = this.collectFormData();
    let isValid = true;
    const errors = [];
    formDef.fields.forEach(field => {
      if (field.required) {
        const val = data[field.id];
        const valEl = document.getElementById(`val_${field.id}`);
        if (!val || (typeof val === 'string' && val.trim() === '')) {
          isValid = false;
          errors.push(field.label);
          if (valEl) { valEl.textContent = `${field.label}을(를) 입력해주세요`; valEl.classList.add('error'); }
        } else {
          if (valEl) { valEl.textContent = ''; valEl.classList.remove('error'); }
        }
      }
    });
    return { isValid, errors, data };
  }

  generatePreview(data) {
    const formDef = FORM_FIELDS[this.currentFormType];
    let rows = '';
    formDef.fields.forEach(field => {
      if (field.type === 'checklist') {
        const items = data[field.id] || [];
        rows += `<tr><th>${field.label}</th><td>${items.length > 0 ? items.join(', ') : '-'}</td></tr>`;
      } else {
        let value = data[field.id] || '-';
        if (field.type === 'number' && value !== '-') value = parseInt(value).toLocaleString() + '원';
        rows += `<tr><th>${field.label}</th><td>${value}</td></tr>`;
      }
    });
    return `<h2>${formDef.title}</h2>
      <table class="preview-table"><tbody>${rows}</tbody></table>
      <div style="margin-top:30px;display:flex;justify-content:space-between;font-size:0.85rem;">
        <div><div style="margin-bottom:30px;">위와 같이 결의합니다.</div><div>결의일자: ${data.resDate || new Date().toISOString().split('T')[0]}</div></div>
        <div style="text-align:center;"><div style="border-top:1px solid #333;width:120px;padding-top:8px;">결 재</div></div>
      </div>`;
  }

  exportAsPDF(previewEl) {
    const printWindow = window.open('', '_blank');
    if (!printWindow) { window.app?.showToast('팝업 차단을 해제해 주세요.', 'error'); return; }
    printWindow.document.write(`<!DOCTYPE html><html><head><meta charset="UTF-8"><title>${FORM_FIELDS[this.currentFormType].title}</title>
      <style>@import url('https://fonts.googleapis.com/css2?family=Noto+Sans+KR:wght@300;400;500;600;700&display=swap');
      body{font-family:'Noto Sans KR',sans-serif;padding:40px;color:#1a1a1a;line-height:1.6}
      h2{text-align:center;font-size:1.4rem;border-bottom:2px solid #333;padding-bottom:10px;margin-bottom:20px}
      table{width:100%;border-collapse:collapse;margin-bottom:20px}
      th,td{border:1px solid #999;padding:8px 12px;font-size:0.88rem}
      th{background:#f0f0f0;font-weight:600;text-align:left;width:120px}
      @media print{body{padding:20mm}}</style></head><body>${previewEl.innerHTML}</body></html>`);
    printWindow.document.close();
    setTimeout(() => printWindow.print(), 500);
    this.generatedDocs++;
    this.saveDocCount();
    window.app?.updateStats();
  }

  // ============================================
  // 엑셀 내보내기 (2025년 지출내역 양식 기준)
  // ============================================
  exportAsExcel(data, expenseRecords) {
    // expenseRecords: array of objects with keys matching EXCEL_COLUMNS
    const records = expenseRecords || [];

    // If current form data exists, map to one Excel row
    if (data && Object.keys(data).length > 0) {
      const row = this.mapFormToExcelRow(data);
      records.push(row);
    }

    if (records.length === 0) {
      window.app?.showToast('내보낼 데이터가 없습니다.', 'error');
      return;
    }

    // Build CSV with BOM for Korean Excel compatibility
    const BOM = '\uFEFF';
    const headers = EXCEL_COLUMNS.map(c => c.label);
    const csvRows = [headers.join('\t')];

    records.forEach(record => {
      const row = EXCEL_COLUMNS.map(col => {
        const val = record[col.key] || '';
        return String(val).replace(/\t/g, ' ').replace(/\n/g, ' ');
      });
      csvRows.push(row.join('\t'));
    });

    const csvContent = BOM + csvRows.join('\n');
    const blob = new Blob([csvContent], { type: 'text/tab-separated-values;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const dateStr = new Date().toISOString().split('T')[0].replace(/-/g, '');
    a.download = `ER바이오코어_지출내역_${dateStr}.xls`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    window.app?.showToast(`📊 엑셀 파일이 다운로드됩니다 (${records.length}건)`, 'success');
  }

  mapFormToExcelRow(data) {
    const dateRaw = (data.resDate || '').replace(/-/g, '');
    return {
      no: '',
      scheduledDate: dateRaw,
      transferDate: '',
      description: data.description || '',
      amount: data.amount || '',
      actualAmount: data.amount || '',
      fromBank: data.fromBank || '기업은행',
      fromAccount: data.fromAccount || '55402028004050',
      payee: data.vendor || data.source || '',
      toBank: data.toBank || '',
      toAccount: data.toAccount || '',
      processType: data.processType || '청구서작성',
      fundSource: data.fundSource || '국고',
      expenseCategory: data.accountTitle || '',
      subCategory: data.subCategory || '',
      evidenceDate: dateRaw,
      supplyAmount: data.supplyAmount || '',
      vatAmount: data.vatAmount || '',
      status: '승인',
      vendor: data.vendor || data.source || '',
      accountingDate: '',
      docNumber: '',
      resolutionNumber: data.resNo || ''
    };
  }
}

export { FormManager };
