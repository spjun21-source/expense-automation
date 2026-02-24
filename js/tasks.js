// ============================================================
// 사업단 경비 처리 자동화 - Daily Tasks Module (v5.2)
// 상태별 요약표, 일일 비망록(Comment), 실시간 저장 피드백 강화
// ============================================================

class TaskManager {
    constructor(userId, options = {}) {
        this.userId = userId;
        this.currentDate = this._todayStr();
        this.isAdmin = options.isAdmin || false;
        this.allUserIds = options.allUserIds || [userId];
        this.filterUserId = '전체'; // 관리자 필터 (기본: 전체)
    }

    _todayStr() {
        return new Date().toISOString().split('T')[0];
    }

    _storageKey(date) {
        return `daily_tasks_shared_${date || this.currentDate}`;
    }

    _commentKey(date) {
        return `daily_comment_shared_${date || this.currentDate}`;
    }

    _load(date) {
        try {
            return JSON.parse(localStorage.getItem(this._storageKey(date)) || '[]');
        } catch { return []; }
    }

    _save(tasks, date) {
        localStorage.setItem(this._storageKey(date), JSON.stringify(tasks));
        this._showSavedIndicator();
    }

    _saveComment(comment, date) {
        localStorage.setItem(this._commentKey(date), comment || '');
        this._showSavedIndicator();
    }

    _loadComment(date) {
        return localStorage.getItem(this._commentKey(date)) || '';
    }

    _showSavedIndicator() {
        const indicator = document.getElementById('taskSaveIndicator');
        if (indicator) {
            indicator.classList.remove('visible');
            void indicator.offsetWidth; // trigger reflow
            indicator.classList.add('visible');
            setTimeout(() => indicator.classList.remove('visible'), 1500);
        }
    }

    setUser(userId) { this.userId = userId; }

    setDate(dateStr) { this.currentDate = dateStr; }

    prevDate() {
        const d = new Date(this.currentDate);
        d.setDate(d.getDate() - 1);
        this.currentDate = d.toISOString().split('T')[0];
        return this.currentDate;
    }

    nextDate() {
        const d = new Date(this.currentDate);
        d.setDate(d.getDate() + 1);
        const today = this._todayStr();
        const next = d.toISOString().split('T')[0];
        if (next > today) return this.currentDate;
        this.currentDate = next;
        return this.currentDate;
    }

    isToday() {
        return this.currentDate === this._todayStr();
    }

    // ---- 데이터 관리 ----
    getTasks() {
        const allTasks = this._load(this.currentDate);
        if (this.isAdmin && this.filterUserId !== '전체') {
            return allTasks.filter(t => t.userId === this.filterUserId);
        }
        return allTasks;
    }

    addTask(text) {
        if (!text || !text.trim()) return null;
        const tasks = this._load(this.currentDate);
        const task = {
            id: 'task_' + Date.now() + '_' + Math.random().toString(36).slice(2, 5),
            text: text.trim(),
            status: '대기',
            memo: '',
            createdAt: new Date().toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' }),
            userId: this.userId
        };
        tasks.push(task);
        this._save(tasks, this.currentDate);
        window.app?.showToast('📌 할일이 추가되었습니다.', 'success');
        return task;
    }

    cycleStatus(taskId, targetUserId) {
        const tasks = this._load(this.currentDate);
        const task = tasks.find(t => t.id === taskId);
        if (!task) return null;

        // Permission check: Owner or Admin
        if (task.userId !== this.userId && !this.isAdmin) {
            window.app?.showToast('⛔ 본인의 업무만 변경할 수 있습니다.', 'error');
            return null;
        }

        const cycle = { '대기': '진행', '진행': '완료', '완료': '대기' };
        task.status = cycle[task.status] || '대기';
        this._save(tasks, this.currentDate);
        return task;
    }

    updateMemo(taskId, memo, targetUserId) {
        const tasks = this._load(this.currentDate);
        const task = tasks.find(t => t.id === taskId);
        if (!task) return null;

        // Permission check: Owner or Admin
        if (task.userId !== this.userId && !this.isAdmin) {
            window.app?.showToast('⛔ 본인의 업무 비고만 수정할 수 있습니다.', 'error');
            return null;
        }

        task.memo = memo;
        this._save(tasks, this.currentDate);
        window.app?.showToast('📝 비고가 저장되었습니다.', 'success');
        return task;
    }

    deleteTask(taskId, targetUserId) {
        const tasks = this._load(this.currentDate);
        const task = tasks.find(t => t.id === taskId);
        if (!task) return;

        // Permission check: Owner or Admin
        if (task.userId !== this.userId && !this.isAdmin) {
            window.app?.showToast('⛔ 본인의 업무만 삭제할 수 있습니다.', 'error');
            return;
        }

        const filtered = tasks.filter(t => t.id !== taskId);
        this._save(filtered, this.currentDate);
        window.app?.showToast('🗑 할일이 삭제되었습니다.', 'info');
    }

    // ---- 통계 및 요약 ----
    getStatsByData(tasks) {
        const total = tasks.length;
        const waiting = tasks.filter(t => t.status === '대기').length;
        const inProgress = tasks.filter(t => t.status === '진행').length;
        const done = tasks.filter(t => t.status === '완료').length;
        const calcPct = (count) => total === 0 ? 0 : Math.round((count / total) * 100);

        return {
            total,
            waiting, waitingPct: calcPct(waiting),
            inProgress, inProgressPct: calcPct(inProgress),
            done, donePct: calcPct(done)
        };
    }

    getAllUsersTasks() {
        return this.getTasks();
    }

    getStatsByUser() {
        const result = {};
        const allTasks = this._load(this.currentDate);

        this.allUserIds.forEach(uid => {
            const userTasks = allTasks.filter(t => t.userId === uid);
            result[uid] = this.getStatsByData(userTasks);
        });
        return result;
    }

    // ============================================
    // 대시보드 렌더링
    // ============================================
    render(container) {
        if (!container) return;
        const isToday = this.isToday();
        const dateDisplay = new Date(this.currentDate + 'T00:00:00').toLocaleDateString('ko-KR', {
            year: 'numeric', month: 'long', day: 'numeric', weekday: 'short'
        });

        // 데이터 로드
        const tasks = this.getTasks();
        const mainStats = this.getStatsByData(tasks);
        const dailyComment = this._loadComment(this.currentDate);

        // 관리자용 사용자별 칩
        let userChipsHtml = '';
        if (this.isAdmin) {
            const byUser = this.getStatsByUser();
            const entries = Object.entries(byUser).filter(([, s]) => s.total > 0 || this.filterUserId === '전체');
            userChipsHtml = `<div class="task-user-summary">
                ${entries.map(([uid, s]) => `
                    <div class="task-user-stat ${this.filterUserId === uid ? 'active' : ''}" data-filter-uid="${uid}">
                        <span class="task-user-id">${uid}</span>
                        <span class="tstat-mini waiting">${s.waiting}</span>
                        <span class="tstat-mini progress">${s.inProgress}</span>
                        <span class="tstat-mini done">${s.done}</span>
                    </div>
                `).join('')}
            </div>`;
        }

        // 헤더 렌더링 (저장 인디케이터 포함)
        container.innerHTML = `
      <div class="tasks-widget">
        <div class="tasks-header">
          <div class="tasks-title-row">
            <h3 class="tasks-title">📌 ${this.isAdmin ? '팀 업무 대시보드' : '오늘의 업무 현황'}</h3>
            <div id="taskSaveIndicator" class="tasks-save-flash">⚡ 저장됨</div>
          </div>
          <div class="tasks-date-nav">
            ${this.isAdmin ? `
              <select class="task-user-filter" id="taskUserFilter">
                <option value="전체" ${this.filterUserId === '전체' ? 'selected' : ''}>👥 팀 전체</option>
                ${this.allUserIds.map(uid => `<option value="${uid}" ${this.filterUserId === uid ? 'selected' : ''}>${uid}</option>`).join('')}
              </select>` : ''}
            <button class="tasks-nav-btn" id="taskPrevDate">◀</button>
            <span class="tasks-date ${isToday ? 'today' : ''}">${dateDisplay}</span>
            <button class="tasks-nav-btn" id="taskNextDate" ${isToday ? 'disabled' : ''}>▶</button>
          </div>
        </div>

        ${userChipsHtml}

        ${isToday && (!this.isAdmin || this.filterUserId === this.userId || this.filterUserId === '전체') ? `
        <div class="tasks-input-row">
          <input type="text" class="tasks-input" id="taskInput" placeholder="새로운 업무를 입력하세요..." maxlength="100">
          <button class="btn btn-primary btn-sm" id="taskAddBtn">추가</button>
        </div>` : ''}

        <div class="tasks-list" id="tasksList">
          ${tasks.length === 0 ? '<div class="tasks-empty">등록된 업무가 없습니다</div>' :
                tasks.map(t => this._renderTask(t, isToday)).join('')}
        </div>

        <!-- 하단 업무 요약표 -->
        <div class="tasks-footer-summary">
            <h4 class="footer-summary-title">📊 업무 진행 요약</h4>
            <table class="task-summary-table">
                <thead>
                    <tr><th>상태</th><th>건수</th><th>비율</th></tr>
                </thead>
                <tbody>
                    <tr class="row-waiting">
                        <td><span class="dot waiting"></span> 대기</td>
                        <td>${mainStats.waiting}건</td>
                        <td><div class="progress-bar"><div class="bar-fill" style="width:${mainStats.waitingPct}%"></div></div> ${mainStats.waitingPct}%</td>
                    </tr>
                    <tr class="row-progress">
                        <td><span class="dot progress"></span> 진행</td>
                        <td>${mainStats.inProgress}건</td>
                        <td><div class="progress-bar"><div class="bar-fill blue" style="width:${mainStats.inProgressPct}%"></div></div> ${mainStats.inProgressPct}%</td>
                    </tr>
                    <tr class="row-done">
                        <td><span class="dot done"></span> 완료</td>
                        <td>${mainStats.done}건</td>
                        <td><div class="progress-bar"><div class="bar-fill green" style="width:${mainStats.donePct}%"></div></div> ${mainStats.donePct}%</td>
                    </tr>
                </tbody>
                <tfoot>
                    <tr><th>합계</th><th>${mainStats.total}건</th><th>100%</th></tr>
                </tfoot>
            </table>
        </div>

        <!-- 일일 비망록 (Comment) -->
        <div class="tasks-comment-area">
            <div class="comment-header">
                <span class="comment-icon">📝</span>
                <span class="comment-title">${this.isAdmin ? '관리자 지시사항 / 팀 비망록' : '오늘의 업무 비망록'}</span>
                <button class="btn-text-only" id="btnSaveComment">수동 저장</button>
            </div>
            <textarea id="dailyCommentInput" class="daily-comment-input" 
                placeholder="${this.isAdmin ? '팀원들에게 남길 지시사항이나 당일 특이사항을 기록하세요...' : '오늘의 주요 성과나 미결 사항을 자유롭게 기록하세요...'}"
                >${dailyComment}</textarea>
            <div class="comment-footer">포커스를 해제하면 자동 저장됩니다.</div>
        </div>
      </div>
    `;
        this._bindEvents(container);
    }

    _renderTask(task, editable) {
        const statusIcons = { '대기': '⬜', '진행': '🔄', '완료': '✅' };
        const statusClass = { '대기': 'waiting', '진행': 'progress', '완료': 'done' };
        const isOwn = task.userId === this.userId;
        const canEdit = editable && (isOwn || this.isAdmin);
        const hasMemo = task.memo && task.memo.trim();

        return `
      <div class="task-item ${statusClass[task.status]}" data-id="${task.id}" data-owner="${task.userId}">
        <button class="task-status-btn ${statusClass[task.status]}" data-action="cycle" data-id="${task.id}" data-owner="${task.userId}" title="상태 변경">
          ${statusIcons[task.status]}
        </button>
        <span class="task-author-badge ${isOwn ? 'own' : ''}">${task.userId}</span>
        <span class="task-text ${task.status === '완료' ? 'completed' : ''}">${task.text}</span>
        <button class="task-memo-btn ${hasMemo ? 'has-memo' : ''}" data-action="memo" data-id="${task.id}" data-owner="${task.userId}" title="${hasMemo ? task.memo : '비고 추가'}">
          ${hasMemo ? '💬' : '📝'}
        </button>
        <span class="task-time">${task.createdAt}</span>
        ${canEdit ? `<button class="task-delete-btn" data-action="delete" data-id="${task.id}" data-owner="${task.userId}" title="삭제">🗑</button>` : ''}
      </div>
      ${hasMemo ? `<div class="task-memo-display" data-memo-for="${task.id}"><span class="memo-label">비고:</span> ${task.memo}</div>` : ''}`;
    }

    _bindEvents(container) {
        // 업무 추가
        const input = container.querySelector('#taskInput');
        const addBtn = container.querySelector('#taskAddBtn');
        if (input && addBtn) {
            const addTask = () => {
                if (input.value.trim()) {
                    this.addTask(input.value);
                    this.render(container);
                }
            };
            addBtn.addEventListener('click', addTask);
            input.addEventListener('keydown', e => { if (e.key === 'Enter') addTask(); });
        }

        // 상태 변경, 삭제, 개별 메모
        container.querySelectorAll('[data-action]').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const action = btn.dataset.action;
                const id = btn.dataset.id;
                const owner = btn.dataset.owner || this.userId;

                if (action === 'cycle') {
                    this.cycleStatus(id, owner);
                    this.render(container);
                } else if (action === 'delete') {
                    if (confirm('이 업무를 삭제하시겠습니까?')) {
                        this.deleteTask(id, owner);
                        this.render(container);
                    }
                } else if (action === 'memo') {
                    e.stopPropagation();
                    this._showMemoEditor(container, id, owner);
                }
            });
        });

        // 비망록 (Comment) 저장
        const commentInput = container.querySelector('#dailyCommentInput');
        const saveCommentBtn = container.querySelector('#btnSaveComment');
        if (commentInput) {
            const saveComment = () => {
                const val = commentInput.value;
                this._saveComment(val, this.currentDate);
            };
            commentInput.addEventListener('blur', saveComment);
            saveCommentBtn?.addEventListener('click', () => {
                saveComment();
                window.app?.showToast('📝 비망록이 저장되었습니다.', 'success');
            });
        }

        // 관리자 필터
        container.querySelector('#taskUserFilter')?.addEventListener('change', (e) => {
            this.filterUserId = e.target.value;
            this.render(container);
        });

        // 사용자 칩 클릭 필터
        container.querySelectorAll('[data-filter-uid]').forEach(el => {
            el.addEventListener('click', () => {
                this.filterUserId = el.dataset.filterUid;
                this.render(container);
            });
        });

        // 날짜 탐색
        container.querySelector('#taskPrevDate')?.addEventListener('click', () => {
            this.prevDate();
            this.render(container);
        });
        container.querySelector('#taskNextDate')?.addEventListener('click', () => {
            this.nextDate();
            this.render(container);
        });
    }

    _showMemoEditor(container, taskId, ownerId) {
        const tasks = this._load(this.currentDate);
        const task = tasks.find(t => t.id === taskId);
        const currentMemo = task?.memo || '';

        const existingEditor = container.querySelector('.task-memo-editor');
        if (existingEditor) existingEditor.remove();

        const taskItem = container.querySelector(`[data-id="${taskId}"].task-item`);
        if (!taskItem) return;

        const editor = document.createElement('div');
        editor.className = 'task-memo-editor';
        editor.innerHTML = `
      <input type="text" class="task-memo-input" value="${currentMemo}" placeholder="비고 내용을 입력하세요..." maxlength="200">
      <div class="editor-actions">
        <button class="btn btn-xs btn-primary task-memo-save">저장</button>
        <button class="btn btn-xs btn-outline task-memo-cancel">취소</button>
      </div>
    `;

        const memoDisplay = container.querySelector(`[data-memo-for="${taskId}"]`);
        const insertAfter = memoDisplay || taskItem;
        insertAfter.parentNode.insertBefore(editor, insertAfter.nextSibling);

        const memoInput = editor.querySelector('.task-memo-input');
        memoInput.focus();

        const saveMemo = () => {
            this.updateMemo(taskId, memoInput.value.trim(), ownerId);
            this.render(container);
        };

        editor.querySelector('.task-memo-save').addEventListener('click', saveMemo);
        memoInput.addEventListener('keydown', e => { if (e.key === 'Enter') saveMemo(); });
        editor.querySelector('.task-memo-cancel').addEventListener('click', () => editor.remove());
    }
}

export { TaskManager };
