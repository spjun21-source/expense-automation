const APP_VERSION = 'v5.2.38.3 (CoreBot v1.2.0)';

console.log('📦 [app.js] Module load start (v5.2.38.3)');

import { WORKFLOW_STEPS, SCENARIOS, FORM_FIELDS, DOCUMENT_TYPES, EXCEL_COLUMNS } from './data.js?v=5.2.37';
import { TutorialEngine } from './tutorial.js?v=5.2.37';
import { FormManager } from './forms.js?v=5.2.37';
import { AuthManager } from './auth.js?v=5.2.37';
import { DocumentStore } from './store.js?v=5.2.37';
import { TaskManager } from './tasks.js?v=5.2.37';
import { ApprovalManager } from './approval.js';

// Production Ready

class App {
    constructor() {
        console.log('⚡ [App] Constructor started');
        if (window.setDiag) window.setDiag('App 엔진 시동 중...');

        try {
            this.auth = new AuthManager();
            this.store = new DocumentStore();
            this.tutorial = new TutorialEngine();
            this.formManager = new FormManager();
            this.approvalMgr = new ApprovalManager(this.store);

            this.taskMgr = null;
            this.currentTab = 'production';
            this.expenseData = [];
            this.editingDocId = null;

            this.init();
            window.app = this; // Global exposure
        } catch (err) {
            console.error('🛑 [App] Constructor Crash:', err);
            if (window.setDiag) window.setDiag(`초기화 오류: ${err.message}`, true);
            alert(`🛑 초기화 실패 (Constructor): ${err.message}`);
        }
    }

    _updateDiagnostic(msg) {
        if (window.setDiag) window.setDiag(msg);
        console.log(`[Diagnostic] ${msg}`);
    }

    async init() {
        console.log('🚀 App Initialization Started');
        this._updateDiagnostic('이벤트 바인딩 중...');

        try {
            // 🚨 최우선 순위: 로그인 버튼부터 살리기
            this._bindLoginEvents();

            // 2. 부가 기능 바인딩
            this._bindStaticEvents();

            // 3. 현재 상태에 따라 화면 표시
            if (this.auth.isLoggedIn()) {
                this._updateDiagnostic('세션 확인됨. 앱 로드 중...');
                await this._showApp();
            } else {
                this._updateDiagnostic('시스템 준비 완료 (로그인 필요)');
                this._showLogin();
            }
            console.log('✅ UI Initialization Success');
        } catch (initErr) {
            console.error('🛑 App Init Crash:', initErr);
            this._updateDiagnostic(`실행 오류: ${initErr.message}`);
        }
    }

    _bindStaticEvents() {
        // 탭 전환 이벤트 (즉시 바인딩)
        // v5.2.29: Sidebar Navigation Events
        document.querySelectorAll('.nav-btn').forEach(btn => {
            btn.addEventListener('click', () => this.switchTab(btn.dataset.tab));
        });

        // 로그아웃 (즉시 바인딩)
        document.getElementById('logoutBtn')?.addEventListener('click', () => {
            console.log('Logout clicked');
            this.auth.logout();
            this.editingDocId = null;
            this._showLogin();
        });
    }

    // ============================================
    // Login / Logout
    // ============================================
    _showLogin() {
        const loginOverlay = document.getElementById('loginOverlay');
        const mainApp = document.getElementById('mainApp');
        if (loginOverlay) loginOverlay.style.display = 'flex';
        if (mainApp) mainApp.style.display = 'none';
    }

    async _showApp() {
        const loginOverlay = document.getElementById('loginOverlay');
        const mainApp = document.getElementById('mainApp');
        if (loginOverlay) loginOverlay.style.display = 'none';
        if (mainApp) mainApp.style.display = 'flex';

        // 즉시 탭 구조 렌더링 (데이터는 비동기 로딩)
        this.switchTab(this.currentTab);

        // 데이터 로딩 시작
        await this._initApp();
    }

    _bindLoginEvents() {
        try {
            console.log('🔄 [App] Binding Login Events');
            const loginBtn = document.getElementById('loginBtn');
            const loginId = document.getElementById('loginId');
            const loginPw = document.getElementById('loginPw');
            const loginError = document.getElementById('loginError');

            if (!loginBtn) {
                console.error('❌ [App] loginBtn not found! App initialization might be compromised.');
                return;
            }

            const doLogin = async () => {
                // 부착된 시점의 요소를 다시 찾아서 쓰도록 (상태 불일치 방지)
                const currentBtn = document.getElementById('loginBtn');
                const currentId = document.getElementById('loginId');
                const currentPw = document.getElementById('loginPw');
                const currentError = document.getElementById('loginError');

                if (!currentBtn || !currentId || !currentPw) {
                    console.error('❌ [App] Login elements gone during click!');
                    return;
                }

                console.log('⚡ [App] Login Attempt Started:', currentId.value);
                currentBtn.disabled = true;
                currentBtn.textContent = '로그인 중...';

                try {
                    const result = await this.auth.login(currentId.value, currentPw.value);
                    console.log('📝 [App] Login Result:', result.success ? 'Success' : 'Fail');

                    if (result.success) {
                        currentError.textContent = '';
                        currentId.value = '';
                        currentPw.value = '';
                        await this._showApp();
                    } else {
                        currentError.textContent = result.error;
                    }
                } catch (err) {
                    console.error('❌ [App] Login Process Crash:', err);
                    alert(`⚠️ 로그인 통신 중 오류: ${err.message}`);
                } finally {
                    const finalBtn = document.getElementById('loginBtn');
                    if (finalBtn) {
                        finalBtn.disabled = false;
                        finalBtn.textContent = '로그인';
                    }
                }
            };

            // 기존 리스너 제거 (이 과정에서 복제되므로 함수 내부에선 다시 getElementById 해야함)
            loginBtn.replaceWith(loginBtn.cloneNode(true));
            const activeBtn = document.getElementById('loginBtn');
            activeBtn.onclick = null; // 인라인 핸들러 제거
            activeBtn.addEventListener('click', (e) => {
                e.preventDefault();
                doLogin();
            });

            // Input 엔터키 바인딩
            loginPw?.addEventListener('keydown', e => { if (e.key === 'Enter') doLogin(); });
            loginId?.addEventListener('keydown', e => { if (e.key === 'Enter') loginPw?.focus(); });

            console.log('✅ [App] Login Events Bound Successfully');
        } catch (e) {
            console.error('❌ [App] Login Event Binding Fatal Error:', e);
        }
    }

    async _initApp() {
        const user = this.auth.getCurrentUser();
        if (!user) return;

        // Header info
        const headerUser = document.getElementById('headerUser');
        const headerRole = document.getElementById('headerRole');
        if (headerUser) headerUser.textContent = `👤 ${user.name} (${APP_VERSION})`;
        if (headerRole) {
            headerRole.textContent = user.role === 'admin' ? '관리자' : '사용자';
            headerRole.className = `header-role ${user.role} glow`;
        }

        // Date
        const dateEl = document.getElementById('currentDate');
        if (dateEl) {
            dateEl.textContent = new Date().toLocaleDateString('ko-KR', {
                year: 'numeric', month: 'long', day: 'numeric', weekday: 'long'
            });
        }

        // Cloud Data Loading (Non-blocking UI with Timeout)
        try {
            console.log('🔄 [App] Loading Data with v5.2.0 Safety...');

            const withTimeout = (promise, ms, name) => {
                return Promise.race([
                    promise,
                    new Promise((_, reject) => setTimeout(() => reject(new Error(`${name} Timeout (${ms}ms)`)), ms))
                ]);
            };

            // 1. Wait for bootstrap and store (max 5s)
            console.log('🔄 Init Phase 1: Bootstrap & Store');
            await withTimeout(Promise.all([
                this.auth.bootstrapReady,
                this.store.ready,
                this.tutorial.loadProgress() // Load tutorial progress early
            ]), 7000, 'Cloud Initialization');

            // 2. Fetch Users (max 5s)
            console.log('🔄 Init Phase 2: User Fetch');
            const users = await withTimeout(this.auth.getUsers(), 5000, 'User Fetch');

            console.log('🔄 Init Phase 3: TaskManager Setup');
            const sortedUserIds = users.map(u => u.id).sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
            const userMap = {};
            users.forEach(u => userMap[u.id.toLowerCase()] = u.name);

            this.taskMgr = new TaskManager(user.id, {
                isAdmin: this.auth.isAdmin(),
                allUserIds: sortedUserIds,
                userMap: userMap
            });

            const taskContainer = document.getElementById('tasksContainer');
            if (taskContainer) {
                console.log('🔄 Init Phase 4: Task Render');
                await withTimeout(this.taskMgr.render(taskContainer), 3000, 'Task Render');
            }

            // Load extra data
            console.log('🔄 Init Phase 5: Extra Data');
            await this.loadExpenseData();
            console.log('✅ [App] All Data Loaded Successfully');
        } catch (err) {
            console.error('⚠️ [App] Safety Fallback Triggered:', err.message);
            // Fallback: Initialize with whatever we have
            if (!this.taskMgr) {
                this.taskMgr = new TaskManager(user.id, {
                    isAdmin: this.auth.isAdmin(),
                    allUserIds: [user.id]
                });
            }
            const taskContainer = document.getElementById('tasksContainer');
            if (taskContainer) await this.taskMgr.render(taskContainer);
            await this.loadExpenseData();
        }

        // Admin UI visibility (v5.2.29 Sidebar)
        const isAdmin = this.auth.isAdmin();
        if (isAdmin) {
            document.querySelectorAll('.admin-only').forEach(el => el.style.display = '');
            const adminNav = document.getElementById('adminNav');
            if (adminNav) adminNav.style.display = 'block';
            this.updatePendingBadge();
        } else {
            document.querySelectorAll('.admin-only').forEach(el => el.style.display = 'none');
            const adminNav = document.getElementById('adminNav');
            if (adminNav) adminNav.style.display = 'none';
        }

        // Update Cloud Indicator (v5.1.7 Real Validation)
        const cloudIndicator = document.getElementById('cloudIndicator');
        const updateStatus = async () => {
            if (cloudIndicator) {
                if (this.auth.supabase) {
                    try {
                        const withTimeout = (promise, ms) => Promise.race([
                            promise, new Promise((_, r) => setTimeout(() => r(new Error('timeout')), ms))
                        ]);

                        const { error } = await withTimeout(
                            this.auth.supabase.from('users').select('id').limit(1),
                            5000
                        );
                        if (error) throw error;
                        cloudIndicator.className = 'cloud-indicator online';
                        cloudIndicator.querySelector('.status-text').textContent = 'Cloud Connected';
                    } catch (e) {
                        cloudIndicator.className = 'cloud-indicator offline';
                        let msg = 'Cloud Offline';
                        const curKey = this.auth.supabase.supabaseKey || '';
                        if (curKey.startsWith('sb_publishable')) {
                            msg = 'Cloud Error (Stripe Key)';
                        }
                        cloudIndicator.querySelector('.status-text').textContent = msg;
                    }
                } else {
                    cloudIndicator.className = 'cloud-indicator offline';
                    cloudIndicator.querySelector('.status-text').textContent = 'Cloud Offline (LocalStorage)';
                }
            }
        };
        updateStatus();
        // Resolution type selector
        document.querySelectorAll('.resolution-type-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                document.querySelectorAll('.resolution-type-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                const type = btn.dataset.type;
                this.formManager.setFormType(type);
                this.editingDocId = null;
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
        document.getElementById('btnSaveDoc')?.addEventListener('click', () => this.saveDocument());
        document.getElementById('btnSubmitDoc')?.addEventListener('click', () => this.submitDocument());

        // Export filtered
        document.getElementById('btnExportFiltered')?.addEventListener('click', () => this.exportFiltered());

        // Set default export dates
        const today = new Date().toISOString().split('T')[0];
        const monthAgo = new Date(Date.now() - 30 * 86400000).toISOString().split('T')[0];
        const startInput = document.getElementById('exportStart');
        const endInput = document.getElementById('exportEnd');
        if (startInput) startInput.value = monthAgo;
        if (endInput) endInput.value = today;

        // Initial renders
        await this.tutorial.init(document.getElementById('workflowContainer'), user.id);
        this.formManager.init(user.id);
        this.tutorial.renderScenarios(document.getElementById('scenarioGrid'));
        this.formManager.renderForm(document.getElementById('formEditorBody'));
        this.renderDocGuide();
        this.renderExpenseReference();
        this.renderMyDocs();
        if (this.auth.isAdmin()) {
            this.approvalMgr.renderPendingList(document.getElementById('approvalContainer'));
            this.approvalMgr.renderHistory(document.getElementById('approvalHistoryContainer'));
            await this.approvalMgr.renderUserManagement(document.getElementById('userMgmtContainer'), this.auth);
        }
        this.updateStats();

        // Cloud Document Refresh
        window.addEventListener('docs-updated', () => {
            console.log('📢 UI Refresh: Documents Updated in Cloud');
            if (this.currentTab === 'mydocs') this.renderMyDocs();
            if (this.currentTab === 'admin' && this.auth.isAdmin()) {
                this.approvalMgr.renderPendingList(document.getElementById('approvalContainer'));
                this.approvalMgr.renderHistory(document.getElementById('approvalHistoryContainer'));
            }
            this.updatePendingBadge();
            this.updateStats();
        });
    }

    async loadExpenseData() {
        try {
            const resp = await fetch('./js/expense_2025.json');
            const json = await resp.json();
            const sheet = json.sheet1 || [];
            if (sheet.length > 1) {
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

        // Sidebar active state
        document.querySelectorAll('.nav-btn').forEach(btn => btn.classList.toggle('active', btn.dataset.tab === tabId));

        const panelMap = {
            tutorial: 'panelTutorial',
            practice: 'panelPractice',
            production: 'panelProduction',
            mydocs: 'panelMyDocs',
            admin: 'panelAdmin',
            reference: 'panelReference',
            'user-mgmt': 'panelAdmin' // Map User Management to Admin panel
        };

        document.querySelectorAll('.tab-panel').forEach(panel => panel.classList.remove('active'));
        const activePanel = document.getElementById(panelMap[tabId]);
        if (activePanel) activePanel.classList.add('active');

        // Header Title Update
        const pageTitleNode = document.getElementById('pageTitle');
        if (pageTitleNode) {
            const activeBtn = document.querySelector(`.nav-btn[data-tab="${tabId}"]`);
            if (activeBtn) pageTitleNode.textContent = activeBtn.textContent.replace(/[^\w\s가-힣]/g, '').trim();
        }

        // Tab Content Load
        if (tabId === 'mydocs') this.renderMyDocs();
        else if ((tabId === 'admin' || tabId === 'user-mgmt') && this.auth.isAdmin()) {
            this.approvalMgr.renderPendingList(document.getElementById('approvalContainer'));
            this.approvalMgr.renderHistory(document.getElementById('approvalHistoryContainer'));
            this.approvalMgr.renderUserManagement(document.getElementById('userMgmtContainer'), this.auth);

            // Auto-scroll to User Management if that was clicked
            if (tabId === 'user-mgmt') {
                document.getElementById('userMgmtContainer')?.scrollIntoView({ behavior: 'smooth' });
            }
        }
    }

    updateStats() {
        const stats = this.tutorial.getStats();
        const user = this.auth.getCurrentUser();
        const myDocs = user ? this.store.getByUser(user.id) : [];
        const els = {
            statSteps: `${stats.completedSteps}/${stats.totalSteps}`,
            statQuiz: `${stats.quizRate}%`,
            statScenarios: `${stats.completedScenarios}/${stats.totalScenarios}`,
            statDocs: myDocs.length
        };
        Object.entries(els).forEach(([id, val]) => {
            const el = document.getElementById(id);
            if (el) el.textContent = val;
        });
    }

    updatePendingBadge() {
        const badge = document.getElementById('pendingBadge');
        if (!badge) return;
        const count = this.store.getPendingCount();
        if (count > 0) {
            badge.textContent = count;
            badge.style.display = 'inline-flex';
        } else {
            badge.style.display = 'none';
        }
    }

    // ============================================
    // 문서 저장 / 제출
    // ============================================
    async saveDocument() {
        const { isValid, errors, data } = this.formManager.validateForm();
        if (!isValid) { this.showToast(`필수 항목을 입력해주세요: ${errors.join(', ')}`, 'error'); return; }
        const user = this.auth.getCurrentUser();
        if (!user) return;

        if (this.editingDocId) {
            const result = await this.store.update(this.editingDocId, data);
            if (result.success) {
                this.showToast('💾 문서가 수정·저장되었습니다.', 'success');
            } else {
                this.showToast(result.error, 'error');
            }
        } else {
            const doc = await this.store.save(this.formManager.currentFormType, data, user);
            this.editingDocId = doc.id;
            this.showToast('💾 문서가 저장되었습니다. (상태: 작성중)', 'success');
        }
        await this.updateStats();
    }

    async submitDocument() {
        // Save first if needed
        const { isValid, errors, data } = this.formManager.validateForm();
        if (!isValid) { this.showToast(`필수 항목을 입력해주세요: ${errors.join(', ')}`, 'error'); return; }
        const user = this.auth.getCurrentUser();
        if (!user) return;

        let docId = this.editingDocId;
        if (!docId) {
            const doc = await this.store.save(this.formManager.currentFormType, data, user);
            docId = doc.id;
        } else {
            await this.store.update(docId, data);
        }

        const result = await this.store.submit(docId);
        if (result.success) {
            this.showToast('📤 문서가 결재 제출되었습니다.', 'success');
            this.editingDocId = null;
            this.formManager.setFormType(this.formManager.currentFormType);
            this.formManager.renderForm(document.getElementById('formEditorBody'));
            this.updateStats();
            this.updatePendingBadge();
        } else {
            this.showToast(result.error, 'error');
        }
    }

    // ============================================
    // 내 문서 관리
    // ============================================
    renderMyDocs() {
        const container = document.getElementById('myDocsContainer');
        if (!container) return;
        const user = this.auth.getCurrentUser();
        if (!user) return;
        const docs = this.store.getByUser(user.id);

        const statusIcons = { '작성중': '✏️', '제출': '📤', '승인': '✅', '반려': '❌' };
        const statusClass = { '작성중': 'draft', '제출': 'submitted', '승인': 'approved', '반려': 'rejected' };

        container.innerHTML = `
      <div class="mydocs-summary">
        <span>전체 ${docs.length}건</span>
        <span class="doc-count draft">작성중 ${docs.filter(d => d.status === '작성중').length}</span>
        <span class="doc-count submitted">제출 ${docs.filter(d => d.status === '제출').length}</span>
        <span class="doc-count approved">승인 ${docs.filter(d => d.status === '승인').length}</span>
        <span class="doc-count rejected">반려 ${docs.filter(d => d.status === '반려').length}</span>
      </div>
      ${docs.length === 0 ? '<div class="mydocs-empty">작성한 문서가 없습니다. ⚡ 실전 모드에서 결의서를 작성해보세요.</div>' :
                `<div class="mydocs-list">
          ${docs.map(doc => {
                    const formDef = FORM_FIELDS[doc.formType];
                    return `<div class="mydoc-card ${statusClass[doc.status]}">
              <div class="mydoc-status"><span class="status-badge ${statusClass[doc.status]}">${statusIcons[doc.status]} ${doc.status}</span></div>
              <div class="mydoc-info">
                <span class="mydoc-type">${formDef?.title || doc.formType}</span>
                <span class="mydoc-desc">${doc.data.description || doc.data.incomeDesc || doc.data.subDesc || '-'}</span>
                ${doc.data.amount ? `<span class="mydoc-amount">${parseInt(doc.data.amount).toLocaleString()}원</span>` : ''}
              </div>
              <div class="mydoc-meta">
                <span>작성: ${new Date(doc.createdat || doc.createdAt).toLocaleDateString('ko-KR')}</span>
                <span>수정: ${new Date(doc.updatedat || doc.updatedAt).toLocaleDateString('ko-KR')}</span>
                ${doc.approvalComment ? `<span class="mydoc-comment">💬 ${doc.approvalComment}</span>` : ''}
              </div>
              <div class="mydoc-actions">
                ${(doc.status === '작성중' || doc.status === '반려') ?
                            `<button class="btn btn-sm btn-outline" data-action="edit" data-id="${doc.id}">✏️ 수정</button>` : ''}
                ${doc.status === '작성중' ?
                            `<button class="btn btn-sm btn-primary" data-action="submit" data-id="${doc.id}">📤 제출</button>
                  <button class="btn btn-sm btn-danger" data-action="delete" data-id="${doc.id}">🗑 삭제</button>` : ''}
              </div>
            </div>`;
                }).join('')}
        </div>`}`;

        // Bind events
        container.querySelectorAll('[data-action]').forEach(btn => {
            btn.addEventListener('click', () => {
                const action = btn.dataset.action;
                const id = btn.dataset.id;
                if (action === 'edit') this.editDocument(id);
                else if (action === 'submit') {
                    this.store.submit(id).then(result => {
                        if (result.success) {
                            this.showToast('📤 제출되었습니다.', 'success');
                            this.renderMyDocs();
                            this.updatePendingBadge();
                        } else this.showToast(result.error, 'error');
                    });
                } else if (action === 'delete') {
                    if (confirm('정말 삭제하시겠습니까?')) {
                        this.store.delete(id).then(result => {
                            if (result.success) {
                                this.showToast('🗑 삭제되었습니다.', 'success');
                                this.renderMyDocs();
                                this.updateStats();
                            } else this.showToast(result.error, 'error');
                        });
                    }
                }
            });
        });
    }

    editDocument(docId) {
        const doc = this.store.getById(docId);
        if (!doc) return;
        this.editingDocId = docId;
        this.formManager.setFormType(doc.formType);

        // Switch to production tab
        this.switchTab('production');

        // Activate correct resolution type button
        document.querySelectorAll('.resolution-type-btn').forEach(b => {
            b.classList.toggle('active', b.dataset.type === doc.formType);
        });
        const titleEl = document.getElementById('formEditorTitle');
        if (titleEl) titleEl.textContent = (FORM_FIELDS[doc.formType]?.title || '') + ' (수정중)';

        // Render and fill form
        this.formManager.renderForm(document.getElementById('formEditorBody'));
        // Fill in saved data
        setTimeout(() => {
            Object.entries(doc.data).forEach(([key, value]) => {
                const el = document.getElementById(`field_${key}`);
                if (el) {
                    el.value = value;
                    el.dispatchEvent(new Event('input'));
                }
            });
        }, 50);
    }

    // ============================================
    // 기간별 엑셀 내보내기
    // ============================================
    exportFiltered() {
        const startDate = document.getElementById('exportStart')?.value || '';
        const endDate = document.getElementById('exportEnd')?.value || '';
        const status = document.getElementById('exportStatus')?.value || '전체';

        const docs = this.store.getFiltered({ startDate, endDate, status });
        if (docs.length === 0) {
            this.showToast('해당 기간/상태의 문서가 없습니다.', 'error');
            return;
        }

        const records = docs.map(doc => this.formManager.mapFormToExcelRow(doc.data));
        this.formManager.exportAsExcel(null, records);
        this.showToast(`📊 ${docs.length}건 내보내기 완료`, 'success');
    }

    // ============================================
    // 증빙 가이드
    // ============================================
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

    // ============================================
    // 2025 지출내역 참조 테이블
    // ============================================
    renderExpenseReference() {
        const container = document.getElementById('expenseRefContainer');
        if (!container || this.expenseData.length === 0) return;

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

    // ============================================
    // Form Actions (legacy)
    // ============================================
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

// Startup Logic
const startApp = () => {
    if (window.appStarted) return;
    window.appStarted = true;
    console.log('🎉 [System] Starting Application...');
    if (window.setDiag) window.setDiag('시스템 시동 중...');
    try {
        window.app = new App();
    } catch (err) {
        console.error('🛑 FATAL STARTUP:', err);
        if (window.setDiag) window.setDiag(`시동 실패: ${err.message}`, true);
        alert('🛑 시스템 시작 오류: ' + err.message);
    }
};

if (document.readyState === 'complete' || document.readyState === 'interactive') {
    startApp();
} else {
    document.addEventListener('DOMContentLoaded', startApp);
}
// Failsafe for module execution context
setTimeout(startApp, 1000);
