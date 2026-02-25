// ============================================================

import { WORKFLOW_STEPS } from './data.js';
import { initSupabase } from './supabase.js';

class TaskManager {
    constructor(userid, options = {}) {
        this.userid = userid;
        this.currentDate = this._todayStr();
        this.isAdmin = options.isAdmin || false;
        this.allUserIds = options.allUserIds || [userid];
        this.filterUserId = '전체';

        this.supabase = initSupabase();
        this.container = null;
        this.syncStatus = 'IDLE';
        this._setupRealtime();
    }

    _todayStr() {
        // 모든 브라우저에서 동일한 한국 표준시(KST) 날짜를 사용하도록 강제
        const now = new Date();
        const kstOffset = 9 * 60; // KST is UTC+9
        const kstDate = new Date(now.getTime() + (kstOffset * 60 * 1000));
        return kstDate.toISOString().split('T')[0];
    }

    _storageKey(date) {
        return `daily_tasks_shared_${date || this.currentDate}`;
    }

    _commentKey(date) {
        return `daily_comment_shared_${date || this.currentDate}`;
    }

    async _withTimeout(promise, ms = 2000, name = 'Task Query') {
        return Promise.race([
            promise,
            new Promise((_, reject) => setTimeout(() => reject(new Error(`${name} Timeout`)), ms))
        ]);
    }

    async _load(date) {
        if (this.supabase) {
            try {
                const { data, error } = await this._withTimeout(
                    this.supabase.from('tasks').select('*')
                        .eq('date', date || this.currentDate)
                        .order('createdat', { ascending: true }),
                    1500, 'Tasks Load'
                );
                if (error) throw error;
                // v5.2.14: Data Normalization (DB 대소문자 차이 극복)
                return (data || []).map(row => ({
                    id: row.id,
                    text: row.text,
                    status: row.status,
                    userid: row.userid || row.userId,
                    workflowid: row.workflowid || row.workflowId,
                    memo: row.memo,
                    createdat: row.createdat || row.createdAt,
                    createdatfull: row.createdatfull || row.createdAtFull,
                    date: row.date
                }));
            } catch (e) {
                console.warn('⚠️ [Tasks] Cloud Load failed, using local fallback:', e.message);
            }
        }

        // Fallback to localStorage
        try {
            return JSON.parse(localStorage.getItem(this._storageKey(date)) || '[]');
        } catch { return []; }
    }

    async _save(tasks, date) {
        // Local save (always)
        localStorage.setItem(this._storageKey(date), JSON.stringify(tasks));

        // Cloud save (if connected)
        if (this.supabase) {
            // TaskManager mostly operates by replacing the whole set in local mode,
            // but in cloud mode, individual updates are better. 
            // For now, we sync the whole day's tasks to keep logic consistent.
            // Note: In production, we'd upsert individually.
            try {
                const { error } = await this.supabase
                    .from('tasks')
                    .upsert(tasks.map(t => ({ ...t, date: date || this.currentDate })), { onConflict: 'id' });
                if (error) {
                    console.error('Supabase Sync Error:', error);
                    window.app?.showToast('⚠️ 클라우드 동기화 실패 (DB 설정 확인 필요)', 'error');
                }
            } catch (e) {
                console.error(e);
                window.app?.showToast('⚠️ 클라우드 연결 오류', 'error');
            }
        }

        this._showSavedIndicator();
    }

    async _saveComment(comment, date) {
        if (!comment || !comment.trim()) return;

        // v5.2.29: Create new entry instead of overwriting
        const newComment = {
            id: 'cmt_' + Date.now() + '_' + Math.random().toString(36).slice(2, 5),
            date: date || this.currentDate,
            content: comment.trim(),
            userId: this.userid, // v5.2.29: Standardized case
            status: 'pending', // v5.2.31: Add status
            updatedAt: new Date().toISOString()
        };

        // Local cache (v5.2.29: Array-based storage)
        const localData = JSON.parse(localStorage.getItem(this._commentKey(date)) || '[]');
        localData.push(newComment);
        localStorage.setItem(this._commentKey(date), JSON.stringify(localData));

        if (this.supabase) {
            try {
                const { error } = await this.supabase
                    .from('task_comments')
                    .insert(newComment);
                if (error) {
                    console.error('Comment Sync Error:', error);
                    window.app?.showToast('⚠️ 비고 동기화 실패', 'error');
                }
            } catch (e) {
                console.error(e);
            }
        }

        this._showSavedIndicator();
        if (this.container) this.render(this.container);
    }

    async _loadComments(date) {
        if (this.supabase) {
            try {
                const { data, error } = await this._withTimeout(
                    this.supabase.from('task_comments').select('*')
                        .eq('date', date || this.currentDate)
                        .order('updatedAt', { ascending: true }),
                    1500, 'Comments Load'
                );
                if (!error && data) {
                    return data.map(row => ({
                        ...row,
                        userId: row.userId || row.userid,
                        status: row.status || 'pending'
                    }));
                }
            } catch (e) {
                console.warn('⚠️ [Tasks] Comments load failed:', e.message);
            }
        }
        return JSON.parse(localStorage.getItem(this._commentKey(date)) || '[]');
    }

    async deleteComment(commentId) {
        if (!confirm('이 지시사항/비망록을 삭제하시겠습니까?')) return;

        if (this.supabase) {
            await this.supabase.from('task_comments').delete().eq('id', commentId);
        }

        // Always update local cache
        const localData = JSON.parse(localStorage.getItem(this._commentKey(this.currentDate)) || '[]');
        const filtered = localData.filter(c => c.id !== commentId);
        localStorage.setItem(this._commentKey(this.currentDate), JSON.stringify(filtered));

        window.app?.showToast('🗑 비망록이 삭제되었습니다.', 'info');
        if (this.container) this.render(this.container);
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

    setUser(userid) { this.userid = userid; }

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

    _setupRealtime() {
        if (!this.supabase) return;

        // Clean up previous channel if any
        if (this.channel) this.channel.unsubscribe();

        this.channel = this.supabase
            .channel('task-sync-main')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'tasks' }, payload => {
                console.log('📡 [Realtime Payload Check]:', payload);
                const newData = payload.new;
                if (newData && newData.date === this.currentDate) {
                    window.app?.showToast(`🔄 [${newData.userid || newData.userId}] 팀 업무 실시간 업데이트`, 'info');
                    if (this.container) this.render(this.container);
                } else {
                    console.log('🔈 [Realtime] Item for different date ignored.');
                }
            })
            .on('postgres_changes', { event: '*', schema: 'public', table: 'task_comments' }, payload => {
                console.log('📡 [Realtime] Comments Updated:', payload);
                if (this.container) this.render(this.container);
            })
            .subscribe((status) => {
                this.syncStatus = status;
                console.log(`📡 [Realtime] Status: ${status}`);
                if (status === 'SUBSCRIBED') {
                    console.log('✅ Realtime Connection Established');
                } else if (status === 'CHANNEL_ERROR') {
                    console.warn('⚠️ Realtime Connection Error. Check SQL Publication settings.');
                }
            });
    }

    // ---- 데이터 관리 ----
    async getTasks() {
        const allTasks = await this._load(this.currentDate);
        this.syncStatus = 'SYNCED';
        if (this.isAdmin && this.filterUserId !== '전체') {
            return allTasks.filter(t => t.userid === this.filterUserId);
        }
        return allTasks;
    }

    async addTask(text, workflowId = '') {
        if (!text || !text.trim()) return null;
        const now = new Date();
        const task = {
            id: 'task_' + Date.now() + '_' + Math.random().toString(36).slice(2, 5),
            text: text.trim(),
            status: '대기',
            memo: '',
            createdat: now.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' }),
            createdatfull: now.toLocaleString('ko-KR', {
                year: 'numeric', month: '2-digit', day: '2-digit',
                hour: '2-digit', minute: '2-digit'
            }),
            userid: this.userid,
            workflowid: workflowId,
            date: this.currentDate
        };

        // 1. Local Cache Save
        const tasks = await this._load(this.currentDate);
        tasks.push(task);
        localStorage.setItem(this._storageKey(this.currentDate), JSON.stringify(tasks));

        // 2. Cloud Direct Insert (Trigger Real-time)
        if (this.supabase) {
            try {
                const { error } = await this.supabase.from('tasks').insert(task);
                if (error) {
                    console.error('❌ [Supabase Error Details]:', JSON.stringify(error, null, 2));
                    window.app?.showToast(`❌ 서버 저장 거부됨: ${error.message} (${error.code || 'No Code'})`, 'error');
                    return null;
                } else {
                    console.log('✅ Cloud Sync Success:', task.id);
                    window.app?.showToast('✅ 서버 동기화 완료', 'success');
                }
            } catch (e) {
                console.warn('⚠️ Cloud Sync failed:', e.message);
                window.app?.showToast('⚠️ 클라우드 통신 실패 (오프라인 상동)', 'warning');
            }
        }

        if (this.container) this.render(this.container);
        return task;
    }

    async forceRefresh() {
        window.app?.showToast('🔄 서버 데이터를 동기화합니다...', 'info');
        if (this.container) await this.render(this.container);
    }

    async cycleStatus(taskId, targetUserId) {
        const tasks = await this._load(this.currentDate);
        const task = tasks.find(t => t.id === taskId);
        if (!task) return null;

        // Permission check: Owner or Admin
        if (task.userid !== this.userid && !this.isAdmin) {
            window.app?.showToast('⛔ 본인의 업무만 변경할 수 있습니다.', 'error');
            return null;
        }

        const cycle = { '대기': '진행', '진행': '완료', '완료': '대기' };
        task.status = cycle[task.status] || '대기';

        if (this.supabase) {
            await this.supabase.from('tasks').update({ status: task.status }).eq('id', taskId);
        } else {
            await this._save(tasks, this.currentDate);
        }
        return task;
    }

    async updateMemo(taskId, memo, targetUserId) {
        const tasks = await this._load(this.currentDate);
        const task = tasks.find(t => t.id === taskId);
        if (!task) return null;

        // Permission check: Owner or Admin
        if (task.userid !== this.userid && !this.isAdmin) {
            window.app?.showToast('⛔ 본인의 업무 비고만 수정할 수 있습니다.', 'error');
            return null;
        }

        task.memo = memo;
        if (this.supabase) {
            await this.supabase.from('tasks').update({ memo: memo }).eq('id', taskId);
        } else {
            await this._save(tasks, this.currentDate);
        }
        window.app?.showToast('📝 비고가 저장되었습니다.', 'success');
        return task;
    }

    async deleteTask(taskId, targetUserId) {
        const tasks = await this._load(this.currentDate);
        const task = tasks.find(t => t.id === taskId);
        if (!task) return;

        // Permission check: Owner or Admin
        if (task.userid !== this.userid && !this.isAdmin) {
            window.app?.showToast('⛔ 본인의 업무만 삭제할 수 있습니다.', 'error');
            return;
        }

        if (this.supabase) {
            await this.supabase.from('tasks').delete().eq('id', taskId);
        } else {
            const filtered = tasks.filter(t => t.id !== taskId);
            await this._save(filtered, this.currentDate);
        }
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

    async getStatsByUser() {
        const result = {};
        const allTasks = await this._load(this.currentDate);

        this.allUserIds.forEach(uid => {
            const userTasks = allTasks.filter(t => t.userid === uid);
            result[uid] = this.getStatsByData(userTasks);
        });
        return result;
    }

    // ============================================
    // 대시보드 렌더링
    // ============================================
    async render(container) {
        if (!container) return;
        this.container = container;
        const isToday = this.isToday();
        const dateDisplay = new Date(this.currentDate + 'T00:00:00').toLocaleDateString('ko-KR', {
            year: 'numeric', month: 'long', day: 'numeric', weekday: 'short'
        });

        // 데이터 로드
        const tasks = await this.getTasks();
        const mainStats = this.getStatsByData(tasks);
        const dailyComments = await this._loadComments(this.currentDate);

        // 상단 사용자 필터 칩 구성 (v5.2.29)
        const userChipsHtml = this.isAdmin ? `
            <div class="user-filter-chips">
                <div class="user-chip ${!this.filterUserId ? 'active' : ''}" data-filter-uid="">전체보기</div>
                ${this.allUserIds.map(uid => `
                    <div class="user-chip ${this.filterUserId === uid ? 'active' : ''}" data-filter-uid="${uid}">${uid}</div>
                `).join('')}
            </div>
        ` : '';

        // ... header and stats 

        // 488: Traceable Timeline Rendering
        const commentsHtml = dailyComments.length === 0 ?
            '<div class="comments-empty">등록된 지시사항이나 비망록이 없습니다.</div>' :
            dailyComments.map((c, idx) => `
                <div class="comment-item ${c.status === 'completed' ? 'completed' : ''}" data-cmt-id="${c.id}">
                    <div class="comment-seq">#${idx + 1}</div>
                    <div class="comment-body">
                        <div class="comment-text">${c.content}</div>
                        <div class="comment-meta">
                            👤 ${c.userId} | ${new Date(c.updatedAt).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })}
                        </div>
                    </div>
                    <div class="comment-actions">
                        <button class="btn-icon c-status-toggle" data-cmt-id="${c.id}" data-status="${c.status || 'pending'}" title="${c.status === 'completed' ? '대기상태로 변경' : '완료처리'}">
                            ${c.status === 'completed' ? '✅' : '⏳'}
                        </button>
                        ${this.isAdmin || c.userId === this.userid ? `
                            <button class="btn-icon c-delete-btn" data-cmt-id="${c.id}" title="삭제">🗑️</button>
                        ` : ''}
                    </div>
                </div>
            `).join('');

        container.innerHTML = `
          <div class="tasks-widget">
            <!-- Header, UserChips, Input logic exactly as before but UI is adjusted for Sidebar -->
            <div class="tasks-header">
                <h3 class="tasks-title">📌 ${this.isAdmin ? '팀 업무 대시보드' : '오늘의 업무 현황'}</h3>
                <div class="tasks-date-nav">
                    <button class="tasks-nav-btn" id="taskPrevDate">◀</button>
                    <span class="tasks-date">${dateDisplay}</span>
                    <button class="tasks-nav-btn" id="taskNextDate" ${isToday ? 'disabled' : ''}>▶</button>
                    <button class="tasks-nav-btn" id="taskRefreshCloud">🔄</button>
                </div>
            </div>

            ${userChipsHtml}

            <!-- Task List and Summary Sections... -->
            <div class="tasks-list" id="tasksList">
                ${tasks.length === 0 ? '<div class="tasks-empty">데이터가 없습니다.</div>' : tasks.map(t => this._renderTask(t, isToday)).join('')}
            </div>

            <div class="tasks-comment-area v5-2-31">
                <div class="comment-header">
                    <span class="comment-title">📝 ${this.isAdmin ? '관리자 지시사항' : '팀 비망록'}</span>
                </div>
                <div class="comment-input-row">
                    <input type="text" id="dailyCommentInput" placeholder="${this.isAdmin ? '지시사항을 입력하세요...' : '비망록을 입력하세요...'}" maxlength="500">
                    <button class="btn btn-sm btn-primary" id="btnSaveComment">등록</button>
                </div>
                <div class="comments-timeline">
                    ${commentsHtml}
                </div>
            </div>
          </div>
        `;

        container.innerHTML = html;
        this._bindEvents(container);
    }

    async toggleCommentStatus(cmtId, currentStatus) {
        const newStatus = currentStatus === 'completed' ? 'pending' : 'completed';
        if (this.supabase) {
            try {
                await this.supabase.from('task_comments').update({ status: newStatus }).eq('id', cmtId);
            } catch (e) { console.error(e); }
        }
        // Local Sync
        const local = JSON.parse(localStorage.getItem(this._commentKey()) || '[]');
        const idx = local.findIndex(c => c.id === cmtId);
        if (idx !== -1) {
            local[idx].status = newStatus;
            localStorage.setItem(this._commentKey(), JSON.stringify(local));
        }
        if (this.container) this.render(this.container);
    }

    async deleteComment(cmtId) {
        if (!confirm('지시사항을 삭제하시겠습니까?')) return;
        if (this.supabase) {
            try {
                await this.supabase.from('task_comments').delete().eq('id', cmtId);
            } catch (e) { console.error(e); }
        }
        // Local Sync
        const local = JSON.parse(localStorage.getItem(this._commentKey()) || '[]');
        const filtered = local.filter(c => c.id !== cmtId);
        localStorage.setItem(this._commentKey(), JSON.stringify(filtered));
        if (this.container) this.render(this.container);
    }

    _renderTask(task, editable) {
        const statusIcons = { '대기': '⬜', '진행': '🔄', '완료': '✅' };
        const statusClass = { '대기': 'waiting', '진행': 'progress', '완료': 'done' };
        const isOwn = task.userid === this.userid;
        const canEdit = editable && (isOwn || this.isAdmin);
        const hasMemo = task.memo && task.memo.trim();
        const workflow = task.workflowid ? WORKFLOW_STEPS.find(s => s.id === task.workflowid) : null;

        return `
      <div class="task-item ${statusClass[task.status]}" data-id="${task.id}" data-owner="${task.userid}">
        <button class="task-status-btn ${statusClass[task.status]}" data-action="cycle" data-id="${task.id}" data-owner="${task.userid}" title="상태 변경">
          ${statusIcons[task.status]}
        </button>
        <div class="task-main-content">
          <div class="task-meta-top">
            <span class="task-author-badge ${isOwn ? 'own' : ''}">${task.userid}</span>
            ${workflow ? `<span class="task-workflow-badge">🔗 ${workflow.title}</span>` : ''}
            <span class="task-full-time" title="생성 일시">${task.createdatfull || task.createdat}</span>
          </div>
          <div class="task-text-row">
            <span class="task-text ${task.status === '완료' ? 'completed' : ''}">${task.text}</span>
          </div>
        </div>
        <button class="task-memo-btn ${hasMemo ? 'has-memo' : ''}" data-action="memo" data-id="${task.id}" data-owner="${task.userid}" title="${hasMemo ? task.memo : '비고 추가'}">
          ${hasMemo ? '💬' : '📝'}
        </button>
        ${canEdit ? `<button class="task-delete-btn" data-action="delete" data-id="${task.id}" data-owner="${task.userid}" title="삭제">🗑</button>` : ''}
      </div>
      ${hasMemo ? `<div class="task-memo-display" data-memo-for="${task.id}"><span class="memo-label">비고:</span> ${task.memo}</div>` : ''}`;
    }

    _bindEvents(container) {
        // 업무 추가
        const input = container.querySelector('#taskInput');
        const workflowSelect = container.querySelector('#taskWorkflowLink');
        const addBtn = container.querySelector('#taskAddBtn');
        if (input && addBtn) {
            const addTask = async () => {
                if (input.value.trim()) {
                    await this.addTask(input.value, workflowSelect?.value || '');
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
                const owner = btn.dataset.owner || this.userid;

                if (action === 'cycle') {
                    this.cycleStatus(id, owner).then(() => this.render(container));
                } else if (action === 'delete') {
                    if (confirm('이 업무를 삭제하시겠습니까?')) {
                        this.deleteTask(id, owner).then(() => this.render(container));
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
        if (commentInput && saveCommentBtn) {
            const saveComment = async () => {
                const val = commentInput.value;
                if (val.trim()) {
                    await this._saveComment(val, this.currentDate);
                    commentInput.value = ''; // Clear after save
                    window.app?.showToast('📝 지시사항이 등록되었습니다.', 'success');
                }
            };
            saveCommentBtn.addEventListener('click', saveComment);
            commentInput.addEventListener('keydown', e => { if (e.key === 'Enter') saveComment(); });
        }

        // 비망록 삭제 (Delegation)
        container.querySelectorAll('.c-delete-btn').forEach(btn => {
            btn.addEventListener('click', async () => {
                const id = btn.dataset.cmtId;
                await this.deleteComment(id);
            });
        });

        // 비망록 토글 (v5.2.31)
        container.querySelectorAll('.c-status-toggle').forEach(btn => {
            btn.addEventListener('click', async () => {
                const id = btn.dataset.cmtId;
                const status = btn.dataset.status;
                await this.toggleCommentStatus(id, status);
            });
        });

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

        // 클라우드 새로고침
        container.querySelector('#taskRefreshCloud')?.addEventListener('click', () => {
            this.forceRefresh();
        });
    }

    async _showMemoEditor(container, taskId, ownerId) {
        const tasks = await this._load(this.currentDate);
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

        const saveMemo = async () => {
            await this.updateMemo(taskId, memoInput.value.trim(), ownerId);
            this.render(container);
        };

        editor.querySelector('.task-memo-save').addEventListener('click', saveMemo);
        memoInput.addEventListener('keydown', e => { if (e.key === 'Enter') saveMemo(); });
        editor.querySelector('.task-memo-cancel').addEventListener('click', () => editor.remove());
    }
}

export { TaskManager };
