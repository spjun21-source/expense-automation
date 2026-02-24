// ============================================================
// 사업단 경비 처리 자동화 - Tutorial Engine (v2)
// ============================================================

import { WORKFLOW_STEPS, SCENARIOS, OVERALL_OVERVIEW } from './data.js';
import { initSupabase } from './supabase.js';

class TutorialEngine {
  constructor() {
    this.userId = null;
    this.supabase = initSupabase();
    this.progress = { completedSteps: [], quizResults: {}, completedScenarios: [] };
    this.currentScenario = null;
    this.currentStep = 0;
    this.container = null;
    this.searchTerm = '';
  }

  async init(container, userId) {
    this.container = container;
    this.userId = userId;
    await this.loadProgress();
    this._setupRealtime();
    this.renderWorkflow(this.container);
    this._bindEvents();
    this.bindQuizEvents(this.container);
  }

  _bindEvents() {
    // Search functionality
    const searchInput = document.getElementById('tutorialSearchInput');
    if (searchInput) {
      searchInput.addEventListener('input', (e) => {
        this.searchTerm = e.target.value.toLowerCase();
        this.renderWorkflow(this.container);
      });
    }

    // Overall Overview button
    const overviewBtn = document.getElementById('btnOverallOverview');
    if (overviewBtn) {
      overviewBtn.addEventListener('click', () => {
        this.showOverallOverview();
      });
    }
  }

  showOverallOverview() {
    const modal = document.createElement('div');
    modal.className = 'modal active';
    modal.innerHTML = `
      <div class="modal-content modal-lg">
        <div class="modal-header">
          <h2 class="modal-title">${OVERALL_OVERVIEW.title}</h2>
          <button class="modal-close">&times;</button>
        </div>
        <div class="modal-body tutorial-overview-body">
          <p class="overview-desc">${OVERALL_OVERVIEW.description}</p>
          <div class="overview-content-rich">
            ${OVERALL_OVERVIEW.content}
          </div>
        </div>
        <div class="modal-footer">
          <button class="btn btn-primary btn-modal-close">확인</button>
        </div>
      </div>
    `;
    document.body.appendChild(modal);

    const closeBtn = modal.querySelector('.modal-close');
    const footerCloseBtn = modal.querySelector('.btn-modal-close');
    const closeModal = () => {
      modal.classList.remove('active');
      setTimeout(() => modal.remove(), 300);
    };

    closeBtn.onclick = closeModal;
    footerCloseBtn.onclick = closeModal;
    modal.onclick = (e) => { if (e.target === modal) closeModal(); };
  }

  _setupRealtime() {
    if (!this.supabase || !this.userId) return;
    this.supabase
      .channel('public:user_progress')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'user_progress', filter: `userId=eq.${this.userId}` }, async payload => {
        console.log('🔄 Tutorial Progress Sync Received:', payload);
        if (payload.new) {
          this.progress = payload.new.tutorialProgress;
          this.renderWorkflow(this.container);
          if (this.currentScenario) this.renderSimulation(document.getElementById('panelPractice'));
          if (window.app) window.app.updateStats();
        }
      })
      .subscribe();
  }

  async loadProgress() {
    if (this.supabase && this.userId) {
      try {
        const { data, error } = await this.supabase
          .from('user_progress')
          .select('tutorialProgress')
          .eq('userId', this.userId)
          .single();
        if (!error && data) {
          this.progress = data.tutorialProgress;
          return;
        }
      } catch (e) { }
    }

    // Fallback to localStorage
    try {
      const saved = localStorage.getItem(`expense_tutorial_progress_${this.userId}`);
      if (saved) this.progress = JSON.parse(saved);
    } catch (e) { }
  }

  async saveProgress() {
    if (this.userId) {
      localStorage.setItem(`expense_tutorial_progress_${this.userId}`, JSON.stringify(this.progress));

      if (this.supabase) {
        try {
          await this.supabase
            .from('user_progress')
            .upsert({
              userId: this.userId,
              tutorialProgress: this.progress,
              updatedAt: new Date().toISOString()
            }, { onConflict: 'userId' });
        } catch (e) { }
      }
    }
  }

  // ======== 학습 모드: 업무 절차 렌더링 ========
  renderWorkflow(container) {
    if (!container) return;
    container.innerHTML = '';
    let currentGroup = '';

    const filteredSteps = WORKFLOW_STEPS.filter(step => {
      if (!this.searchTerm) return true;
      return (
        step.title.toLowerCase().includes(this.searchTerm) ||
        step.description.toLowerCase().includes(this.searchTerm) ||
        (step.system && step.system.toLowerCase().includes(this.searchTerm)) ||
        (step.details && step.details.some(d => d.toLowerCase().includes(this.searchTerm)))
      );
    });

    if (filteredSteps.length === 0) {
      container.innerHTML = `
        <div class="search-empty">
          <div class="empty-icon">🔍</div>
          <p class="empty-text">'${this.searchTerm}'에 대한 검색 결과가 없습니다.</p>
          <button class="btn btn-sm btn-outline" id="btnResetSearch">초기화</button>
        </div>
      `;
      const resetBtn = container.querySelector('#btnResetSearch');
      if (resetBtn) {
        resetBtn.onclick = () => {
          const searchInput = document.getElementById('tutorialSearchInput');
          if (searchInput) {
            searchInput.value = '';
            this.searchTerm = '';
            this.renderWorkflow(container);
          }
        };
      }
      return;
    }

    filteredSteps.forEach((step, idx) => {
      // Group header
      if (step.groupTitle && step.group !== currentGroup) {
        currentGroup = step.group;
        const groupHeader = document.createElement('div');
        groupHeader.className = `workflow-group-header ${step.group}`;
        groupHeader.innerHTML = `<h3>${step.groupTitle}</h3>`;
        container.appendChild(groupHeader);
      }

      const isCompleted = this.progress.completedSteps.includes(step.id);
      const card = document.createElement('div');
      card.className = `workflow-step ${isCompleted ? 'completed' : ''} group-${step.group || 'default'}`;
      card.dataset.stepIdx = idx;

      // Step number display
      const stepNum = step.order < 1 ? `A${Math.round(step.order * 10) + 1}` : step.order;

      card.innerHTML = `
        <div class="step-header" data-idx="${idx}">
          <div class="step-number">${stepNum}</div>
          <div class="step-info">
            <div class="step-title">${step.icon} ${step.title}</div>
            <div class="step-desc">${step.description}</div>
            ${step.system ? `<div class="step-system-badge">🖥️ ${step.system}</div>` : ''}
            ${step.refPage ? `<span class="step-ref-badge">📖 ${step.refPage}</span>` : ''}
          </div>
          <div class="step-toggle">▼</div>
        </div>
        <div class="step-body" id="stepBody_${idx}" style="display:none;">
          ${step.system ? `
          <div class="step-system-info">
            <div class="system-label">🖥️ 접속 시스템</div>
            <div class="system-name">${step.system}</div>
            ${step.systemUrl ? `<a href="${step.systemUrl}" target="_blank" class="system-link">${step.systemUrl} ↗</a>` : ''}
          </div>` : ''}
          <div class="step-details">
            <h4>상세 절차</h4>
            <ul>${step.details.map(d => `<li>${d}</li>`).join('')}</ul>
          </div>
          ${step.approvalLine ? `
          <div class="step-approval">
            <h4>📋 결재 라인</h4>
            <div class="approval-line-visual">${step.approvalLine.split(' → ').map(p => `<span class="approval-person">${p}</span>`).join('<span class="approval-arrow">→</span>')}</div>
          </div>` : ''}
          ${step.requiredDocs.length > 0 ? `
          <div class="step-docs">
            <h4>📎 필요 서류</h4>
            <div class="doc-tags">${step.requiredDocs.map(d => `<span class="doc-tag">${d}</span>`).join('')}</div>
          </div>` : ''}
          ${step.docTypes ? `
          <div class="step-doc-types">
            <h4>📄 청구(결의)서 유형</h4>
            ${Object.entries(step.docTypes).map(([name, info]) => `
              <div style="margin:8px 0;padding:10px;background:rgba(255,255,255,0.03);border-radius:8px;">
                <div style="font-weight:600;color:var(--primary);">${name}</div>
                <div style="font-size:0.85rem;color:var(--text-muted);margin-top:4px;">${info.description}</div>
                <div style="font-size:0.82rem;margin-top:6px;">예시: ${info.examples.join(', ')}</div>
              </div>
            `).join('')}
          </div>` : ''}
          <div class="step-quiz">
            <h4>📝 이해도 퀴즈</h4>
            <div class="quiz-question">${step.quiz.question}</div>
            <div class="quiz-options">
              ${step.quiz.options.map((opt, oi) => `
                <button class="quiz-option" data-step="${idx}" data-option="${oi}">${opt}</button>
              `).join('')}
            </div>
            <div class="quiz-result" id="quizResult_${idx}"></div>
          </div>
        </div>
      `;
      container.appendChild(card);
    });
  }

  toggleStep(idx, container) {
    const body = document.getElementById(`stepBody_${idx}`);
    if (!body) return;
    const isOpen = body.style.display !== 'none';
    // Close all
    container.querySelectorAll('.step-body').forEach(b => b.style.display = 'none');
    container.querySelectorAll('.step-header').forEach(h => h.classList.remove('open'));
    if (!isOpen) {
      body.style.display = 'block';
      body.closest('.workflow-step').querySelector('.step-header').classList.add('open');
    }
  }

  bindQuizEvents(container) {
    if (!container) return;
    // Step toggle
    container.addEventListener('click', (e) => {
      const header = e.target.closest('.step-header');
      if (header) {
        this.toggleStep(parseInt(header.dataset.idx), container);
        return;
      }

      const optBtn = e.target.closest('.quiz-option');
      if (optBtn) {
        const stepIdx = parseInt(optBtn.dataset.step);
        const optIdx = parseInt(optBtn.dataset.option);
        this.handleQuiz(stepIdx, optIdx, container);
      }
    });
  }

  handleQuiz(stepIdx, optIdx, container) {
    const step = WORKFLOW_STEPS[stepIdx];
    const resultEl = document.getElementById(`quizResult_${stepIdx}`);
    const isCorrect = optIdx === step.quiz.answer;

    // Disable all options for this step
    container.querySelectorAll(`.quiz-option[data-step="${stepIdx}"]`).forEach(btn => {
      btn.disabled = true;
      if (parseInt(btn.dataset.option) === step.quiz.answer) btn.classList.add('correct');
      if (parseInt(btn.dataset.option) === optIdx && !isCorrect) btn.classList.add('wrong');
    });

    this.progress.quizResults[step.id] = isCorrect;
    if (isCorrect && !this.progress.completedSteps.includes(step.id)) {
      this.progress.completedSteps.push(step.id);
      container.querySelectorAll('.workflow-step')[stepIdx]?.classList.add('completed');
    }
    this.saveProgress();

    if (resultEl) {
      resultEl.innerHTML = isCorrect
        ? '<div class="quiz-correct">✅ 정답입니다! 다음 단계로 넘어가세요.</div>'
        : `<div class="quiz-wrong">❌ 오답입니다. 정답은 "${step.quiz.options[step.quiz.answer]}" 입니다.</div>`;
    }

    if (window.app) window.app.updateStats();
    if (isCorrect && window.app?.createConfetti) window.app.createConfetti();
  }

  // ======== 연습 모드: 시나리오 렌더링 ========
  renderScenarios(container) {
    if (!container) return;
    container.innerHTML = '';

    SCENARIOS.forEach(scenario => {
      const isCompleted = this.progress.completedScenarios.includes(scenario.id);
      const card = document.createElement('div');
      card.className = `scenario-card ${isCompleted ? 'completed' : ''}`;
      card.innerHTML = `
        <div class="scenario-icon">${scenario.icon}</div>
        <div class="scenario-title">${scenario.title}</div>
        <div class="scenario-difficulty">
          <span class="difficulty-badge ${scenario.difficulty}">${scenario.difficulty}</span>
        </div>
        <div class="scenario-desc">${scenario.description}</div>
        <div class="scenario-meta">
          <span>💰 ${scenario.budget}</span>
          <span>📂 ${scenario.category}</span>
        </div>
        <button class="btn btn-primary scenario-start" data-scenario="${scenario.id}">
          ${isCompleted ? '🔄 다시 연습' : '🎯 시작하기'}
        </button>
      `;
      container.appendChild(card);
    });

    container.addEventListener('click', (e) => {
      const btn = e.target.closest('.scenario-start');
      if (btn) {
        const scenario = SCENARIOS.find(s => s.id === btn.dataset.scenario);
        if (scenario) this.startScenario(scenario);
      }
    });
  }

  startScenario(scenario) {
    this.currentScenario = scenario;
    this.currentStep = 0;
    // Show simulation panel
    const panel = document.getElementById('panelPractice');
    if (panel) {
      panel.dataset.mode = 'simulation';
      this.renderSimulation(panel);
    }
  }

  exitScenario() {
    this.currentScenario = null;
    this.currentStep = 0;
    const panel = document.getElementById('panelPractice');
    if (panel) {
      delete panel.dataset.mode;
      panel.innerHTML = `
        <div class="section-header">
          <h2 class="section-title">🎯 시나리오 기반 시뮬레이션</h2>
          <p class="section-subtitle">실제와 유사한 상황에서 경비 처리 업무를 연습하세요</p>
        </div>
        <div class="scenario-grid" id="scenarioGrid"></div>
      `;
      this.renderScenarios(document.getElementById('scenarioGrid'));
    }
  }

  renderSimulation(panel) {
    const sc = this.currentScenario;
    if (!sc || !panel) return;
    const step = sc.steps[this.currentStep];
    const totalSteps = sc.steps.length;
    const progress = ((this.currentStep + 1) / totalSteps * 100).toFixed(0);

    panel.innerHTML = `
      <div class="simulation-view">
        <div class="sim-header">
          <button class="btn btn-outline sim-back" id="simBack">← 시나리오 목록</button>
          <div class="sim-title">${sc.icon} ${sc.title}</div>
          <div class="sim-progress">
            <div class="progress-bar"><div class="progress-fill" style="width:${progress}%"></div></div>
            <span>${this.currentStep + 1} / ${totalSteps}</span>
          </div>
        </div>

        <div class="sim-step-card">
          <div class="sim-step-number">STEP ${step.step}</div>
          <div class="sim-step-action">${step.action}</div>
          <div class="sim-step-instruction">${step.instruction}</div>
          ${step.hint ? `<div class="sim-hint">💡 ${step.hint}</div>` : ''}
          ${step.checklist ? `
            <div class="sim-checklist">
              <h4>✅ 체크리스트</h4>
              ${step.checklist.map((item, i) => `
                <label class="checklist-item">
                  <input type="checkbox" class="sim-check" data-idx="${i}">
                  <span>${item}</span>
                </label>
              `).join('')}
            </div>` : ''}
          ${step.formType ? `
            <div class="sim-form-hint">
              <span>📄 이 단계에서 <strong>${step.formType === 'expense_resolution' ? '지출 청구(결의)서' : step.formType === 'income_resolution' ? '수입결의서' : '대체결의서'}</strong>를 작성합니다.</span>
              <button class="btn btn-primary btn-sm" id="goToForm" data-type="${step.formType}">양식 작성하기 →</button>
            </div>` : ''}
          ${step.formFields ? `
            <div class="sim-form-preview">
              <h4>📋 품의서 예시</h4>
              <div style="padding:12px;background:rgba(255,255,255,0.03);border-radius:8px;">
                <div><b>제목:</b> ${step.formFields.title}</div>
                ${step.formFields.content ? `<div><b>내용:</b> ${step.formFields.content}</div>` : ''}
                ${step.formFields.vendor ? `<div><b>업체:</b> ${step.formFields.vendor}</div>` : ''}
                ${step.formFields.amount ? `<div><b>금액:</b> ${step.formFields.amount.toLocaleString()}원</div>` : ''}
              </div>
            </div>` : ''}
        </div>

        ${sc.excelSample ? `
        <div class="sim-excel-preview" style="margin-top:16px;">
          <h4>📊 엑셀 기록 예시</h4>
          <div class="excel-preview-scroll">
            <table class="preview-table compact">
              <tr><th>지출내역</th><td>${sc.excelSample.description}</td></tr>
              <tr><th>지출금액</th><td>${parseInt(sc.excelSample.amount).toLocaleString()}원</td></tr>
              <tr><th>처리유형</th><td>${sc.excelSample.processType}</td></tr>
              <tr><th>재원</th><td>${sc.excelSample.fundSource}</td></tr>
              <tr><th>지출비목</th><td>${sc.excelSample.expenseCategory}</td></tr>
              <tr><th>세세목</th><td>${sc.excelSample.subCategory}</td></tr>
            </table>
          </div>
        </div>` : ''}

        <div class="sim-nav">
          <button class="btn btn-outline" id="simPrev" ${this.currentStep === 0 ? 'disabled' : ''}>← 이전</button>
          ${this.currentStep < totalSteps - 1
        ? `<button class="btn btn-primary" id="simNext">다음 →</button>`
        : `<button class="btn btn-success" id="simComplete">🎉 완료</button>`
      }
        </div>
      </div>
    `;

    // Event bindings
    panel.querySelector('#simBack')?.addEventListener('click', () => this.exitScenario());
    panel.querySelector('#simPrev')?.addEventListener('click', () => { this.currentStep--; this.renderSimulation(panel); });
    panel.querySelector('#simNext')?.addEventListener('click', () => { this.currentStep++; this.renderSimulation(panel); });
    panel.querySelector('#simComplete')?.addEventListener('click', () => this.completeScenario());
    panel.querySelector('#goToForm')?.addEventListener('click', (e) => {
      const type = e.target.dataset.type;
      if (window.app) {
        window.app.switchTab('production');
        // auto-select the form type
        document.querySelectorAll('.resolution-type-btn').forEach(b => {
          b.classList.toggle('active', b.dataset.type === type);
        });
        window.app.formManager.setFormType(type);
        window.app.formManager.renderForm(document.getElementById('formEditorBody'));
      }
    });
  }

  completeScenario() {
    if (this.currentScenario && !this.progress.completedScenarios.includes(this.currentScenario.id)) {
      this.progress.completedScenarios.push(this.currentScenario.id);
      this.saveProgress();
    }
    if (window.app) {
      window.app.showToast(`🎉 "${this.currentScenario.title}" 시나리오를 완료했습니다!`, 'success');
      window.app.createConfetti();
      window.app.updateStats();
    }
    this.exitScenario();
  }

  getStats() {
    return {
      completedSteps: this.progress.completedSteps.length,
      totalSteps: WORKFLOW_STEPS.length,
      quizRate: WORKFLOW_STEPS.length > 0
        ? Math.round(Object.values(this.progress.quizResults).filter(v => v).length / WORKFLOW_STEPS.length * 100)
        : 0,
      completedScenarios: this.progress.completedScenarios.length,
      totalScenarios: SCENARIOS.length
    };
  }
}

export { TutorialEngine };
