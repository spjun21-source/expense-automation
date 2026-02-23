// ============================================================
// 사업단 경비 처리 자동화 - Daily Tasks Module (v5.1)
// 작성자 ID 표시, 관리자 전체조회, 비고란(메모) 기능
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

    _storageKey(userId, date) {
        return `daily_tasks_${userId || this.userId}_${date || this.currentDate}`;
    }

    _load(userId, date) {
        try {
            return JSON.parse(localStorage.getItem(this._storageKey(userId, date)) || '[]');
        } catch { return []; }
    }

    _save(tasks, userId, date) {
        localStorage.setItem(this._storageKey(userId, date), JSON.stringify(tasks));
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

    // ---- 내 할일 ----
    getTasks() {
        return this._load(this.userId, this.currentDate);
    }

    addTask(text) {
        if (!text || !text.trim()) return null;
        const tasks = this._load(this.userId);
        const task = {
            id: 'task_' + Date.now() + '_' + Math.random().toString(36).slice(2, 5),
            text: text.trim(),
            status: '대기',
            memo: '',
            createdAt: new Date().toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' }),
            userId: this.userId
        };
        tasks.push(task);
        this._save(tasks, this.userId);
        return task;
    }

    cycleStatus(taskId, targetUserId) {
        const uid = targetUserId || this.userId;
        const tasks = this._load(uid);
        const task = tasks.find(t => t.id === taskId);
        if (!task) return null;
        const cycle = { '대기': '진행', '진행': '완료', '완료': '대기' };
        task.status = cycle[task.status] || '대기';
        this._save(tasks, uid);
        return task;
    }

    updateMemo(taskId, memo, targetUserId) {
        const uid = targetUserId || this.userId;
        const tasks = this._load(uid);
        const task = tasks.find(t => t.id === taskId);
        if (!task) return null;
        task.memo = memo;
        this._save(tasks, uid);
        return task;
    }

    deleteTask(taskId, targetUserId) {
        const uid = targetUserId || this.userId;
        const tasks = this._load(uid).filter(t => t.id !== taskId);
        this._save(tasks, uid);
    }

    // ---- 통계 ----
    getStats(userId) {
        const tasks = this._load(userId || this.userId);
        return {
            total: tasks.length,
            waiting: tasks.filter(t => t.status === '대기').length,
            inProgress: tasks.filter(t => t.status === '진행').length,
            done: tasks.filter(t => t.status === '완료').length
        };
    }

    // ---- 관리자: 전체 사용자 할일 + 작성자별 통계 ----
    getAllUsersTasks() {
        let allTasks = [];
        const targetIds = this.filterUserId === '전체' ? this.allUserIds : [this.filterUserId];
        targetIds.forEach(uid => {
            const tasks = this._load(uid, this.currentDate);
            tasks.forEach(t => { t.userId = t.userId || uid; });
            allTasks = allTasks.concat(tasks);
        });
        return allTasks;
    }

    getStatsByUser() {
        const result = {};
        this.allUserIds.forEach(uid => {
            result[uid] = this.getStats(uid);
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

        // 관리자: 전체 사용자 할일, 일반 사용자: 본인 할일
        const tasks = this.isAdmin ? this.getAllUsersTasks() : this.getTasks();
        const myStats = this.getStats(this.userId);
        const totalStats = {
            total: tasks.length,
            waiting: tasks.filter(t => t.status === '대기').length,
            inProgress: tasks.filter(t => t.status === '진행').length,
            done: tasks.filter(t => t.status === '완료').length
        };

        // 관리자: 작성자별 통계
        let userSummaryHtml = '';
        if (this.isAdmin) {
            const byUser = this.getStatsByUser();
            const entries = Object.entries(byUser).filter(([, s]) => s.total > 0);
            if (entries.length > 0) {
                userSummaryHtml = `<div class="task-user-summary">
                    ${entries.map(([uid, s]) => `
                        <div class="task-user-stat" data-filter-uid="${uid}">
                            <span class="task-user-id">${uid}</span>
                            <span class="tstat-mini waiting">${s.waiting}</span>
                            <span class="tstat-mini progress">${s.inProgress}</span>
                            <span class="tstat-mini done">${s.done}</span>
                        </div>
                    `).join('')}
                </div>`;
            }
        }

        // 관리자 필터 드롭다운
        let filterHtml = '';
        if (this.isAdmin) {
            filterHtml = `<select class="task-user-filter" id="taskUserFilter">
                <option value="전체" ${this.filterUserId === '전체' ? 'selected' : ''}>👥 전체</option>
                ${this.allUserIds.map(uid => `<option value="${uid}" ${this.filterUserId === uid ? 'selected' : ''}>${uid}</option>`).join('')}
            </select>`;
        }

        container.innerHTML = `
      <div class="tasks-widget">
        <div class="tasks-header">
          <div class="tasks-title-row">
            <h3 class="tasks-title">📌 ${this.isAdmin ? '팀 할일 현황' : '오늘의 할일'}</h3>
            <div class="tasks-stats-mini">
              <span class="tstat waiting" title="대기">${totalStats.waiting}</span>
              <span class="tstat progress" title="진행">${totalStats.inProgress}</span>
              <span class="tstat done" title="완료">${totalStats.done}</span>
            </div>
          </div>
          <div class="tasks-date-nav">
            ${filterHtml}
            <button class="tasks-nav-btn" id="taskPrevDate">◀</button>
            <span class="tasks-date ${isToday ? 'today' : ''}">${dateDisplay}</span>
            <button class="tasks-nav-btn" id="taskNextDate" ${isToday ? 'disabled' : ''}>▶</button>
          </div>
        </div>
        ${userSummaryHtml}
        ${isToday ? `
        <div class="tasks-input-row">
          <input type="text" class="tasks-input" id="taskInput" placeholder="할일을 입력하세요..." maxlength="100">
          <button class="btn btn-primary btn-sm" id="taskAddBtn">추가</button>
        </div>` : ''}
        <div class="tasks-list" id="tasksList">
          ${tasks.length === 0 ? '<div class="tasks-empty">등록된 할일이 없습니다</div>' :
                tasks.map(t => this._renderTask(t, isToday)).join('')}
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
        // Add task
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

        // Status cycle, delete, memo
        container.querySelectorAll('[data-action]').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const action = btn.dataset.action;
                const id = btn.dataset.id;
                const owner = btn.dataset.owner || this.userId;

                if (action === 'cycle') {
                    this.cycleStatus(id, owner);
                    this.render(container);
                } else if (action === 'delete') {
                    this.deleteTask(id, owner);
                    this.render(container);
                } else if (action === 'memo') {
                    e.stopPropagation();
                    this._showMemoEditor(container, id, owner);
                }
            });
        });

        // User filter (admin)
        container.querySelector('#taskUserFilter')?.addEventListener('change', (e) => {
            this.filterUserId = e.target.value;
            this.render(container);
        });

        // User stat click → filter
        container.querySelectorAll('[data-filter-uid]').forEach(el => {
            el.addEventListener('click', () => {
                this.filterUserId = el.dataset.filterUid;
                this.render(container);
            });
        });

        // Date navigation
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
        // Find current memo
        const uid = ownerId || this.userId;
        const tasks = this._load(uid);
        const task = tasks.find(t => t.id === taskId);
        const currentMemo = task?.memo || '';

        // Create inline editor
        const existingEditor = container.querySelector('.task-memo-editor');
        if (existingEditor) existingEditor.remove();

        const taskItem = container.querySelector(`[data-id="${taskId}"].task-item`);
        if (!taskItem) return;

        const editor = document.createElement('div');
        editor.className = 'task-memo-editor';
        editor.innerHTML = `
      <input type="text" class="task-memo-input" value="${currentMemo}" placeholder="${this.isAdmin ? '지시사항 또는 비고...' : '비망록/비고...'}" maxlength="200">
      <button class="btn btn-sm btn-primary task-memo-save" data-save-id="${taskId}" data-save-owner="${uid}">저장</button>
      <button class="btn btn-sm btn-outline task-memo-cancel">취소</button>
    `;

        // Insert after task item (or after memo display if exists)
        const memoDisplay = container.querySelector(`[data-memo-for="${taskId}"]`);
        const insertAfter = memoDisplay || taskItem;
        insertAfter.parentNode.insertBefore(editor, insertAfter.nextSibling);

        const memoInput = editor.querySelector('.task-memo-input');
        memoInput.focus();

        // Save
        const saveMemo = () => {
            this.updateMemo(taskId, memoInput.value.trim(), uid);
            this.render(container);
        };

        editor.querySelector('.task-memo-save').addEventListener('click', saveMemo);
        memoInput.addEventListener('keydown', e => { if (e.key === 'Enter') saveMemo(); });
        editor.querySelector('.task-memo-cancel').addEventListener('click', () => {
            editor.remove();
        });
    }
}

export { TaskManager };
