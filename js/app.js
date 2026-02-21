// ============================================================
// 사업단 경비 처리 자동화 - Main Application (v2)
// ============================================================

import { WORKFLOW_STEPS, SCENARIOS, FORM_FIELDS, DOCUMENT_TYPES, EXCEL_COLUMNS } from './data.js';
import { TutorialEngine } from './tutorial.js';
import { FormManager } from './forms.js';

class App {
    constructor() {
        this.tutorial = new TutorialEngine();
        this.formManager = new FormManager();
        this.currentTab = 'tutorial';
        this.expenseData = [];
        this.init();
    }

    async init() {
        // Date
        const dateEl = document.getElementById('currentDate');
        if (dateEl) {
            dateEl.textContent = new Date().toLocaleDateString('ko-KR', {
                year: 'numeric', month: 'long', day: 'numeric', weekday: 'long'
            });
        }

        // Load 2025 expense data
        await this.loadExpenseData();

        // Tab navigation
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.addEventListener('click', () => this.switchTab(btn.dataset.tab));
        });

        // Resolution type selector
        document.querySelectorAll('.resolution-type-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                document.querySelectorAll('.resolution-type-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                const type = btn.dataset.type;
                this.formManager.setFormType(type);
                const titleEl = document.getElementById('formEditorTitle');
                if (titleEl) titleEl.textContent = FORM_FIELDS[type].title;
                this.formManager.renderForm(document.getElementById('formEditorBody'));
                document.getElementById('previewModal').style.display = 'none';
            });
        });

        // Form action buttons
        document.getElementById('btnPreview')?.addEventListener('click', () => this.previewForm());
        document.getElementById('btnPDF')?.addEventListener('click', () => this.exportForm());
        document.getElementById('btnExcel')?.addEventListener('click', () => this.exportExcel());

        // Initial renders
        this.tutorial.renderWorkflow(document.getElementById('workflowContainer'));
        this.tutorial.bindQuizEvents(document.getElementById('workflowContainer'));
        this.tutorial.renderScenarios(document.getElementById('scenarioGrid'));
        this.formManager.renderForm(document.getElementById('formEditorBody'));
        this.renderDocGuide();
        this.renderExpenseReference();
        this.updateStats();
    }

    async loadExpenseData() {
        try {
            const resp = await fetch('./js/expense_2025.json');
            const json = await resp.json();
            const sheet = json.sheet1 || [];
            if (sheet.length > 1) {
                // First row is headers, rest are data
                const headers = sheet[0];
                for (let i = 1; i < sheet.length; i++) {
                    const row = {};
                    EXCEL_COLUMNS.forEach((col, ci) => {
                        row[col.key] = sheet[i][ci] || '';
                    });
                    this.expenseData.push(row);
                }
            }
        } catch (e) {
            console.log('2025 expense data not loaded:', e);
        }
    }

    switchTab(tabId) {
        this.currentTab = tabId;
        document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.toggle('active', btn.dataset.tab === tabId));
        const panelMap = { tutorial: 'panelTutorial', practice: 'panelPractice', production: 'panelProduction', reference: 'panelReference' };
        document.querySelectorAll('.tab-panel').forEach(panel => panel.classList.remove('active'));
        const activePanel = document.getElementById(panelMap[tabId]);
        if (activePanel) activePanel.classList.add('active');
    }

    updateStats() {
        const stats = this.tutorial.getStats();
        const els = {
            statSteps: `${stats.completedSteps}/${stats.totalSteps}`,
            statQuiz: `${stats.quizRate}%`,
            statScenarios: `${stats.completedScenarios}/${stats.totalScenarios}`,
            statDocs: this.formManager.generatedDocs
        };
        Object.entries(els).forEach(([id, val]) => {
            const el = document.getElementById(id);
            if (el) el.textContent = val;
        });
    }

    // ======== 증빙 가이드: 클릭 상세 조회 ========
    renderDocGuide() {
        const container = document.getElementById('docGrid');
        if (!container) return;
        container.innerHTML = '';

        DOCUMENT_TYPES.forEach(doc => {
            const card = document.createElement('div');
            card.className = 'doc-type-card clickable';
            card.innerHTML = `
        <div class="doc-type-icon">${doc.icon}</div>
        <div class="doc-type-name">${doc.name}</div>
        <div class="doc-type-desc">${doc.description}</div>
        <div class="doc-type-meta">
          <span>🕐 ${doc.when}</span>
          <span>📁 ${doc.format}</span>
        </div>
        <div class="doc-click-hint">클릭하여 상세 보기 →</div>
      `;
            card.addEventListener('click', () => this.showDocDetail(doc));
            container.appendChild(card);
        });
    }

    showDocDetail(doc) {
        const modal = document.getElementById('docDetailModal');
        const content = document.getElementById('docDetailContent');
        if (!modal || !content) return;

        let sampleHtml = '';
        if (doc.sampleFiles && doc.sampleFiles.length > 0) {
            sampleHtml = `<div class="doc-samples"><h4>📂 샘플 파일 (참조용)</h4>
        <ul>${doc.sampleFiles.map(f => `<li><code>${f.split('/').pop()}</code><span class="sample-path"> (${f.split('/')[0]})</span></li>`).join('')}</ul></div>`;
        }

        content.innerHTML = `
      <div class="doc-detail-header">
        <span class="doc-detail-icon">${doc.icon}</span>
        <div>
          <h2>${doc.name}</h2>
          <p>${doc.description}</p>
        </div>
      </div>
      <div class="doc-detail-meta">
        <span>🕐 시점: ${doc.when}</span>
        <span>📁 형식: ${doc.format}</span>
      </div>
      <div class="doc-detail-body">${doc.detailHtml || ''}</div>
      ${sampleHtml}
    `;
        modal.style.display = 'flex';
    }

    closeDocDetail() {
        const modal = document.getElementById('docDetailModal');
        if (modal) modal.style.display = 'none';
    }

    // ======== 2025 지출내역 참조 테이블 ========
    renderExpenseReference() {
        const container = document.getElementById('expenseRefContainer');
        if (!container || this.expenseData.length === 0) return;

        // Summary stats
        const totalAmount = this.expenseData.reduce((sum, r) => sum + (parseInt(r.amount) || 0), 0);
        const categories = {};
        this.expenseData.forEach(r => {
            const cat = r.expenseCategory || '미분류';
            categories[cat] = (categories[cat] || 0) + (parseInt(r.amount) || 0);
        });

        container.innerHTML = `
      <div class="expense-ref-summary">
        <div class="ref-stat-card">
          <div class="ref-stat-value">${this.expenseData.length}건</div>
          <div class="ref-stat-label">총 집행 건수</div>
        </div>
        <div class="ref-stat-card">
          <div class="ref-stat-value">${totalAmount.toLocaleString()}원</div>
          <div class="ref-stat-label">총 집행 금액</div>
        </div>
        <div class="ref-stat-card category-breakdown">
          <div class="ref-stat-label" style="margin-bottom:8px;">비목별 집행 현황</div>
          ${Object.entries(categories).sort((a, b) => b[1] - a[1]).map(([cat, amt]) => `
            <div class="category-row">
              <span class="cat-name">${cat}</span>
              <span class="cat-amount">${amt.toLocaleString()}원</span>
            </div>
          `).join('')}
        </div>
      </div>
      <div class="expense-table-actions">
        <button class="btn btn-outline btn-sm" id="btnExportRefExcel">📊 전체 엑셀 다운로드</button>
        <input type="text" class="form-input search-input" id="expenseSearch" placeholder="🔍 지출내역 검색...">
      </div>
      <div class="expense-table-wrap">
        <table class="expense-table" id="expenseTable">
          <thead><tr>
            <th>NO</th><th>지출예정일자</th><th>지출내역</th><th>지출금액</th>
            <th>지급처</th><th>처리유형</th><th>재원</th><th>지출비목</th><th>진행구분</th>
          </tr></thead>
          <tbody id="expenseTableBody"></tbody>
        </table>
      </div>
    `;

        this.renderExpenseRows(this.expenseData);

        document.getElementById('expenseSearch')?.addEventListener('input', (e) => {
            const q = e.target.value.toLowerCase();
            const filtered = this.expenseData.filter(r =>
                Object.values(r).some(v => String(v).toLowerCase().includes(q))
            );
            this.renderExpenseRows(filtered);
        });

        document.getElementById('btnExportRefExcel')?.addEventListener('click', () => {
            this.formManager.exportAsExcel(null, [...this.expenseData]);
        });
    }

    renderExpenseRows(data) {
        const tbody = document.getElementById('expenseTableBody');
        if (!tbody) return;
        tbody.innerHTML = data.map(r => {
            const amt = parseInt(r.amount) || 0;
            const dateStr = String(r.scheduledDate);
            const formatted = dateStr.length === 8 ? `${dateStr.slice(0, 4)}-${dateStr.slice(4, 6)}-${dateStr.slice(6, 8)}` : dateStr;
            return `<tr>
        <td>${r.no}</td>
        <td>${formatted}</td>
        <td class="desc-cell">${r.description}</td>
        <td class="amount-cell">${amt.toLocaleString()}</td>
        <td>${r.payee}</td>
        <td><span class="type-badge ${r.processType.includes('카드') ? 'card' : 'transfer'}">${r.processType}</span></td>
        <td>${r.fundSource}</td>
        <td>${r.expenseCategory}</td>
        <td><span class="status-badge">${r.status}</span></td>
      </tr>`;
        }).join('');
    }

    // ======== Form Actions ========
    previewForm() {
        const { isValid, errors, data } = this.formManager.validateForm();
        if (!isValid) { this.showToast(`필수 항목을 입력해주세요: ${errors.join(', ')}`, 'error'); return; }
        const previewModal = document.getElementById('previewModal');
        const previewContent = document.getElementById('previewContent');
        previewContent.innerHTML = this.formManager.generatePreview(data);
        previewModal.style.display = 'block';
        previewModal.scrollIntoView({ behavior: 'smooth' });
    }

    exportForm() {
        const { isValid, errors, data } = this.formManager.validateForm();
        if (!isValid) { this.showToast(`필수 항목을 입력해주세요: ${errors.join(', ')}`, 'error'); return; }
        const previewContent = document.getElementById('previewContent');
        previewContent.innerHTML = this.formManager.generatePreview(data);
        this.formManager.exportAsPDF(previewContent);
        this.showToast('📄 PDF 인쇄 대화 상자가 열립니다.', 'success');
    }

    exportExcel() {
        const { isValid, errors, data } = this.formManager.validateForm();
        if (!isValid) { this.showToast(`필수 항목을 입력해주세요: ${errors.join(', ')}`, 'error'); return; }
        this.formManager.exportAsExcel(data, []);
    }

    showToast(message, type = '') {
        const toast = document.getElementById('toast');
        if (!toast) return;
        toast.textContent = message;
        toast.className = `toast ${type} show`;
        setTimeout(() => toast.classList.remove('show'), 3000);
    }

    createConfetti() {
        const container = document.createElement('div');
        container.className = 'confetti-container';
        document.body.appendChild(container);
        const colors = ['#6366f1', '#8b5cf6', '#10b981', '#f59e0b', '#ef4444', '#3b82f6'];
        for (let i = 0; i < 50; i++) {
            const c = document.createElement('div');
            c.className = 'confetti';
            c.style.left = `${Math.random() * 100}%`;
            c.style.top = `${-10 + Math.random() * 20}px`;
            c.style.backgroundColor = colors[Math.floor(Math.random() * colors.length)];
            c.style.animationDelay = `${Math.random() * 2}s`;
            c.style.animationDuration = `${2 + Math.random() * 2}s`;
            container.appendChild(c);
        }
        setTimeout(() => container.remove(), 5000);
    }
}

const app = new App();
window.app = app;
