// ============================================================

import { WORKFLOW_STEPS } from './data.js';
import { initSupabase } from './supabase.js';

const PROCESS_STATUS_OPTIONS = [
    '', '품의', '청구결의', '지출결의', '결재 중', '결재 완료',
    '스캔및 서류철', '재무팀 제출', '이체전송', '이체확인', '이지바로 업로드'
];

class TaskManager {
    constructor(userid, options = {}) {
        this.userid = userid;
        this.currentDate = this._todayStr();
        this.isAdmin = options.isAdmin || false;
        this.allUserIds = options.allUserIds || [userid];
        this.userMap = options.userMap || {};
        this.filterUserId = '전체';

        this.supabase = initSupabase();
        this.container = null;
        this.syncStatus = 'IDLE';
        this.viewMode = 'list'; // 'list', 'calendar', 'weekly'
        this.calendarMonth = new Date(this.currentDate); // keeps track of the calendar's current month
        this.weeklyGroupMode = 'byDate'; // 'byDate' or 'byUser'
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
                const targetDate = date || this.currentDate;
                const { data, error } = await this._withTimeout(
                    this.supabase.from('tasks').select('*')
                        .or(`date.eq.${targetDate},and(date.lt.${targetDate},status.neq.완료)`)
                        .order('createdat', { ascending: true }),
                    5000, 'Tasks Load'
                );
                if (error) throw error;
                // v5.2.14: Data Normalization (DB 대소문자 차이 극복)
                return (data || []).map(row => ({
                    id: row.id,
                    text: row.text,
                    status: row.status,
                    processstatus: row.processstatus || '',
                    userid: (row.userid || row.userId || '').toLowerCase(),
                    workflowid: row.workflowid || row.workflowId,
                    memo: row.memo,
                    category: row.category || '', // Added categorization
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
            userid: this.userid.toLowerCase(),
            status: 'pending',
            updatedat: new Date().toISOString()
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
                } else {
                    this.channel?.send({ type: 'broadcast', event: 'sync-comments', payload: {} }).catch(() => { });
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
                const targetDate = date || this.currentDate;
                const { data, error } = await this._withTimeout(
                    this.supabase.from('task_comments').select('*')
                        .or(`date.eq.${targetDate},and(date.lt.${targetDate},status.neq.completed)`)
                        .order('updatedat', { ascending: true }),
                    5000, 'Comments Load'
                );
                if (!error && data) {
                    return data.map(row => ({
                        ...row,
                        userid: (row.userid || row.userId || '').toLowerCase(),
                        status: row.status || 'pending',
                        updatedat: row.updatedat || row.updatedAt
                    }));
                }
            } catch (e) {
                console.warn('⚠️ [Tasks] Comments load failed:', e.message);
            }
        }
        try {
            return JSON.parse(localStorage.getItem(this._commentKey(date)) || '[]');
        } catch { return []; }
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
                    const taskUserId = (newData.userid || newData.userId || '').toLowerCase();
                    const userName = this.userMap[taskUserId] || taskUserId;
                    window.app?.showToast(`🔄 [${userName}] 업무 내역/상태 업데이트`, 'info');
                    if (this.container) this.render(this.container);
                } else {
                    console.log('🔈 [Realtime] Item for different date ignored.');
                }
            })
            .on('postgres_changes', { event: '*', schema: 'public', table: 'task_comments' }, payload => {
                console.log('📡 [Realtime] Comments Updated:', payload);
                if (this.container) this.render(this.container);
            })
            .on('broadcast', { event: 'sync-comments' }, payload => {
                console.log('📡 [Broadcast] Comments sync forced:', payload);
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
        if (this.filterUserId !== '전체') {
            const lowerFilterId = this.filterUserId.toLowerCase();
            return allTasks.filter(t => (t.userid || '').toLowerCase() === lowerFilterId);
        }
        return allTasks;
    }

    async addTask(text, workflowId = '', customDate = null) {
        if (!text || !text.trim()) return null;
        const now = new Date();
        const targetDate = customDate || this.currentDate;
        const task = {
            id: 'task_' + Date.now() + '_' + Math.random().toString(36).slice(2, 5),
            text: text.trim(),
            status: '대기',
            processstatus: '',
            memo: '',
            createdat: now.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' }),
            createdatfull: now.toLocaleString('ko-KR', {
                year: 'numeric', month: '2-digit', day: '2-digit',
                hour: '2-digit', minute: '2-digit'
            }),
            userid: this.userid.toLowerCase(),
            workflowid: workflowId,
            date: targetDate
        };

        // 1. Local Cache Save
        const tasks = await this._load(targetDate);
        tasks.push(task);
        localStorage.setItem(this._storageKey(targetDate), JSON.stringify(tasks));

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

        const cycle = { '대기': '진행', '진행': '완료', '완료': '대기' };
        task.status = cycle[task.status] || '대기';

        let updates = { status: task.status };
        if (task.date < this.currentDate) {
            task.date = this.currentDate;
            updates.date = this.currentDate;
        }

        if (this.supabase) {
            await this.supabase.from('tasks').update(updates).eq('id', taskId);
        } else {
            await this._save(tasks, this.currentDate);
        }
        return task;
    }

    async updateProcessStatus(taskId, newStatus, targetUserId) {
        const tasks = await this._load(this.currentDate);
        const task = tasks.find(t => t.id === taskId);
        if (!task) return null;

        task.processstatus = newStatus;
        let updates = { processstatus: newStatus };

        if (this.supabase) {
            await this.supabase.from('tasks').update(updates).eq('id', taskId);
        } else {
            await this._save(tasks, this.currentDate);
        }
        return task;
    }

    async updateTask(taskId, newText, newWorkflowId, targetUserId) {
        const tasks = await this._load(this.currentDate);
        const task = tasks.find(t => t.id === taskId);
        if (!task) return null;

        task.text = newText;
        task.workflowid = newWorkflowId;

        let updates = { text: newText, workflowid: newWorkflowId };

        if (this.supabase) {
            await this.supabase.from('tasks').update(updates).eq('id', taskId);
        } else {
            await this._save(tasks, this.currentDate);
        }
        window.app?.showToast('✨ 업무가 수정되었습니다.', 'success');
        return task;
    }

    async updateMemo(taskId, memo, targetUserId) {
        const tasks = await this._load(this.currentDate);
        const task = tasks.find(t => t.id === taskId);
        if (!task) return null;

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
            const lowerUid = uid.toLowerCase();
            const userTasks = allTasks.filter(t => (t.userid || '').toLowerCase() === lowerUid);
            result[uid] = this.getStatsByData(userTasks);
        });
        return result;
    }

    // ============================================
    // 달력 렌더링
    // ============================================
    async renderCalendar(container) {
        if (!container) return;

        const y = this.calendarMonth.getFullYear();
        const m = this.calendarMonth.getMonth();
        const firstDay = new Date(y, m, 1).getDay();
        const daysInMonth = new Date(y, m + 1, 0).getDate();

        // 달력의 시작일과 종료일 계산 (해당 월 전체 데이터를 가져오기 위함)
        const startDateStr = `${y}-${String(m + 1).padStart(2, '0')}-01`;
        const endDateStr = `${y}-${String(m + 1).padStart(2, '0')}-${String(daysInMonth).padStart(2, '0')}`;

        // Get tasks for the whole month
        let monthlyTasks = [];
        if (this.supabase) {
            try {
                const { data } = await this._withTimeout(
                    this.supabase.from('tasks').select('*')
                        .gte('date', startDateStr)
                        .lte('date', endDateStr),
                    5000, 'Monthly Tasks Load'
                );
                monthlyTasks = data || [];
            } catch (e) {
                console.warn('Monthly tasks load failed', e);
            }
        } else {
            // Local fallback: Check all storage keys for this month
            for (let i = 1; i <= daysInMonth; i++) {
                const dateStr = `${y}-${String(m + 1).padStart(2, '0')}-${String(i).padStart(2, '0')}`;
                const dailyTasks = JSON.parse(localStorage.getItem(this._storageKey(dateStr)) || '[]');
                monthlyTasks = monthlyTasks.concat(dailyTasks.map(t => ({ ...t, date: dateStr })));
            }
        }

        // Filter tasks if general filter active
        if (this.filterUserId !== '전체') {
            const lowerFilterId = this.filterUserId.toLowerCase();
            monthlyTasks = monthlyTasks.filter(t => (t.userid || t.userId || '').toLowerCase() === lowerFilterId);
        }

        // Group tasks by date
        const tasksByDate = {};
        monthlyTasks.forEach(t => {
            const d = t.date;
            if (!tasksByDate[d]) tasksByDate[d] = [];
            tasksByDate[d].push(t);
        });

        // Generate calendar grid
        let html = `
          <div class="tasks-widget">
            <div class="tasks-header">
                <h3 class="tasks-title">📌 일정 캘린더</h3>
                <div class="tasks-date-nav">
                    <button class="btn btn-xs btn-outline" id="calToggleList">📋 목록보기</button>
                    <button class="btn btn-xs btn-outline" id="calToggleWeekly">📅 주간보기</button>
                    <button class="tasks-nav-btn" id="calPrevMonth">◀</button>
                    <span class="tasks-date" style="font-weight:bold;">${y}년 ${m + 1}월</span>
                    <button class="tasks-nav-btn" id="calNextMonth">▶</button>
                    <button class="tasks-nav-btn" id="calToday" title="이번달로">📍</button>
                </div>
            </div>
            <div style="padding: 16px;">
                <div style="display:grid; grid-template-columns:repeat(7, 1fr); gap:4px; text-align:center; font-weight:bold; margin-bottom:8px; color:var(--text-muted); font-size:0.85rem;">
                    <div style="color:var(--error);">일</div><div>월</div><div>화</div><div>수</div><div>목</div><div>금</div><div style="color:var(--primary);">토</div>
                </div>
                <div style="display:grid; grid-template-columns:repeat(7, 1fr); gap:4px;">
        `;

        // Empty cells before first day
        for (let i = 0; i < firstDay; i++) {
            html += `<div style="padding:10px; border-radius:8px; border:1px solid transparent;"></div>`;
        }

        const todayStr = this._todayStr();

        for (let i = 1; i <= daysInMonth; i++) {
            const dateStr = `${y}-${String(m + 1).padStart(2, '0')}-${String(i).padStart(2, '0')}`;
            const dayOfWeek = new Date(y, m, i).getDay();
            const isToday = dateStr === todayStr;
            const isSelected = dateStr === this.currentDate;
            const dayTasks = tasksByDate[dateStr] || [];

            let dayColor = 'var(--text)';
            if (dayOfWeek === 0) dayColor = 'var(--error)';
            if (dayOfWeek === 6) dayColor = 'var(--primary)';

            let bg = 'var(--bg-glass)';
            let borderColor = 'var(--border)';
            if (isToday) {
                bg = 'rgba(59, 130, 246, 0.1)';
                borderColor = 'var(--primary)';
            } else if (isSelected) {
                borderColor = 'var(--text)';
            }

            // Text titles for tasks
            let tasksHtml = '';
            if (dayTasks.length > 0) {
                const maxDisplay = 3;
                const displayTasks = dayTasks.slice(0, maxDisplay);
                const hiddenCount = dayTasks.length - maxDisplay;

                tasksHtml = `<div style="display:flex; flex-direction:column; gap:2px; margin-top:4px; text-align:left;">`;
                displayTasks.forEach(t => {
                    const statusColor = t.status === '완료' ? 'var(--success)' : 'var(--error)';
                    const userName = this.userMap[(t.userid || '').toLowerCase()] || t.userid;
                    tasksHtml += `
                        <div style="font-size:0.7rem; color:var(--text); white-space:nowrap; overflow:hidden; text-overflow:ellipsis; background:rgba(0,0,0,0.05); padding:2px 4px; border-radius:4px; border-left: 2px solid ${statusColor};" title="${t.text}">
                            <span style="font-weight:bold; color:var(--primary);">${userName?.substring(0, 2) || ''}</span> ${t.text}
                        </div>
                    `;
                });

                if (hiddenCount > 0) {
                    tasksHtml += `<div style="font-size:0.65rem; color:var(--text-muted); text-align:center;">+${hiddenCount}개 더보기</div>`;
                }
                tasksHtml += `</div>`;
            }

            html += `
                <div class="cal-day-cell" data-date="${dateStr}" style="padding:6px 4px; min-height:80px; border-radius:8px; border:1px solid ${borderColor}; background:${bg}; cursor:pointer; transition:var(--transition); position:relative;">
                    <div style="text-align:center; color:${dayColor}; font-size:0.85rem; font-weight:${isToday || isSelected ? 'bold' : 'normal'}">${i}</div>
                    ${tasksHtml}
                </div>
            `;
        }

        html += `
                </div>
            </div>
            <div style="padding: 12px 16px; border-top: 1px solid var(--border); font-size: 0.8rem; color: var(--text-dim); text-align: center;">
                날짜를 클릭하면 해당 일자의 업무 목록으로 이동합니다.
            </div>
          </div>
        `;

        container.innerHTML = html;

        // Calendar Events
        container.querySelector('#calToggleList')?.addEventListener('click', () => {
            this.viewMode = 'list';
            this.render(container);
        });
        container.querySelector('#calToggleWeekly')?.addEventListener('click', () => {
            this.viewMode = 'weekly';
            this.render(container);
        });
        container.querySelector('#calPrevMonth')?.addEventListener('click', () => {
            this.calendarMonth.setMonth(this.calendarMonth.getMonth() - 1);
            this.renderCalendar(container);
        });
        container.querySelector('#calNextMonth')?.addEventListener('click', () => {
            this.calendarMonth.setMonth(this.calendarMonth.getMonth() + 1);
            this.renderCalendar(container);
        });
        container.querySelector('#calToday')?.addEventListener('click', () => {
            this.calendarMonth = new Date(this._todayStr());
            this.renderCalendar(container);
        });

        container.querySelectorAll('.cal-day-cell').forEach(cell => {
            cell.addEventListener('click', () => {
                this.currentDate = cell.dataset.date;
                this.viewMode = 'list';
                this.render(container);
            });
            cell.addEventListener('mouseover', () => { cell.style.borderColor = 'var(--primary)'; });
            cell.addEventListener('mouseout', () => {
                const dateStr = cell.dataset.date;
                if (dateStr === this.currentDate) cell.style.borderColor = 'var(--text)';
                else if (dateStr === this._todayStr()) cell.style.borderColor = 'var(--primary)';
                else cell.style.borderColor = 'var(--border)';
            });
        });
    }

    // ============================================
    // 주간 렌더링 및 엑셀 내보내기
    // ============================================
    async renderWeekly(container) {
        if (!container) return;

        // Compute weeks for the currently selected calendar month
        const y = this.calendarMonth.getFullYear();
        const m = this.calendarMonth.getMonth();

        // Find the Monday of the first week that includes the 1st of the month
        const firstOfMonth = new Date(y, m, 1);
        const dayOfFirst = firstOfMonth.getDay(); // 0 for Sunday, 1 for Monday
        // Adjust to find the Monday of the week containing the 1st.
        // If 1st is Sunday (0), Monday is 6 days before. If 1st is Monday (1), Monday is 0 days before.
        // If 1st is Tuesday (2), Monday is 1 day before.
        const firstArrangementMonday = new Date(y, m, 1 - (dayOfFirst === 0 ? 6 : dayOfFirst - 1));

        // Create an array of weeks for the month
        const weeks = [];
        let curMonday = new Date(firstArrangementMonday);
        // Add weeks until the monday is in the next month
        while (curMonday.getMonth() === m || (curMonday.getMonth() < m && weeks.length === 0)) {
            const weekDates = [];
            for (let i = 0; i < 7; i++) {
                const d = new Date(curMonday);
                d.setDate(curMonday.getDate() + i);
                weekDates.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`);
            }
            weeks.push(weekDates);
            curMonday.setDate(curMonday.getDate() + 7);
        }

        // Determine active week based on this.currentDate if inside this month, else default to week 1
        let activeWeekIndex = 0;
        for (let i = 0; i < weeks.length; i++) {
            if (weeks[i].includes(this.currentDate)) {
                activeWeekIndex = i;
                break;
            }
        }
        // If we previously navigated to a week that isn't the current date, we use this.weeklyActiveWeekIndex if set
        if (this.weeklyActiveWeekIndex !== undefined && this.weeklyActiveWeekIndex < weeks.length) {
            activeWeekIndex = this.weeklyActiveWeekIndex;
        }

        const weekDates = weeks[activeWeekIndex];
        const startDateStr = weekDates[0];
        const endDateStr = weekDates[6];

        let weeklyTasks = [];
        if (this.supabase) {
            try {
                const { data } = await this._withTimeout(
                    this.supabase.from('tasks').select('*')
                        .gte('date', startDateStr)
                        .lte('date', endDateStr),
                    5000, 'Weekly Tasks Load'
                );
                weeklyTasks = data || [];
            } catch (e) { console.warn('Weekly tasks load failed', e); }
        } else {
            weekDates.forEach(dateStr => {
                const dailyTasks = JSON.parse(localStorage.getItem(this._storageKey(dateStr)) || '[]');
                weeklyTasks = weeklyTasks.concat(dailyTasks.map(t => ({ ...t, date: dateStr })));
            });
        }

        // Filter tasks if general filter active
        if (this.filterUserId !== '전체') {
            const lowerFilterId = this.filterUserId.toLowerCase();
            weeklyTasks = weeklyTasks.filter(t => (t.userid || t.userId || '').toLowerCase() === lowerFilterId);
        }

        const isByDate = this.weeklyGroupMode === 'byDate';

        // Week Tabs HTML
        const weekTabsHtml = weeks.map((w, idx) => `
            <button class="btn btn-xs ${idx === activeWeekIndex ? 'btn-primary' : 'btn-outline'} week-tab-btn" data-week-idx="${idx}">
                ${idx + 1}주차
            </button>
        `).join('');

        // Generate weekly HTML
        let html = `
          <div class="tasks-widget">
            <div class="tasks-header" style="flex-wrap: wrap; gap: 8px;">
                <h3 class="tasks-title">📌 ${y}년 ${m + 1}월 주간 업무 보고서</h3>
                <div class="tasks-date-nav">
                    <button class="btn btn-xs btn-outline" id="weekToggleList">📋 목록보기</button>
                    <button class="btn btn-xs btn-outline" id="weekToggleCalendar">📅 달력보기</button>
                    <button class="btn btn-xs btn-primary" id="weekExportExcel" style="margin-left: 8px;">📥 엑셀 다운로드</button>
                </div>
            </div>
            
            <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:8px; padding: 12px 16px; background: rgba(59, 130, 246, 0.05); border-bottom: 1px solid var(--border);">
                <div style="display:flex; gap:4px; align-items:center;">
                    <button class="tasks-nav-btn" id="weekPrevMonth">◀</button>
                    ${weekTabsHtml}
                    <button class="tasks-nav-btn" id="weekNextMonth">▶</button>
                </div>
                <div style="font-weight: bold; font-size:0.9rem;">
                    ${startDateStr} ~ ${endDateStr}
                </div>
                <div>
                    <select id="weekGroupToggle" class="form-select" style="padding: 4px 24px 4px 8px; font-size:0.85rem; height:auto;">
                        <option value="byDate" ${isByDate ? 'selected' : ''}>일자별 보기</option>
                        <option value="byUser" ${!isByDate ? 'selected' : ''}>담당자별 보기</option>
                    </select>
                </div>
            </div>
            
            <div style="padding: 16px; overflow-y: auto; max-height: 500px;">
        `;

        const dateHeaders = ['일', '월', '화', '수', '목', '금', '토']; // Adjusted for getDay() output

        if (weeklyTasks.length === 0) {
            html += `<div style="text-align:center; padding:20px; color:var(--text-muted);">이번 주에 등록된 업무가 없습니다.</div>`;
        } else {
            if (isByDate) {
                // Group By Date
                weekDates.forEach((dateStr, idx) => {
                    const dayTasks = weeklyTasks.filter(t => t.date === dateStr);
                    if (dayTasks.length > 0) {
                        html += `
                            <div style="margin-bottom: 16px; border: 1px solid var(--border); border-radius: 8px; overflow: hidden;">
                                <div style="background: var(--surface); padding: 8px 12px; font-weight: bold; border-bottom: 1px solid var(--border);">
                                    ${dateStr} (${dateHeaders[new Date(dateStr).getDay()]})
                                </div>
                                <div style="padding: 12px; display: flex; flex-direction: column; gap: 8px;">
                                    ${dayTasks.map(t => this._renderWeeklyTaskItem(t)).join('')}
                                </div>
                            </div>
                        `;
                    }
                });
            } else {
                // Group By User
                const users = [...new Set(weeklyTasks.map(t => (t.userid || '').toLowerCase()))];
                users.forEach(uid => {
                    const userTasks = weeklyTasks.filter(t => (t.userid || '').toLowerCase() === uid);
                    const userName = this.userMap[uid] || uid;

                    html += `
                        <div style="margin-bottom: 16px; border: 1px solid var(--border); border-radius: 8px; overflow: hidden;">
                            <div style="background: var(--surface); padding: 8px 12px; font-weight: bold; border-bottom: 1px solid var(--border); color: var(--primary);">
                                👤 ${userName}
                            </div>
                            <div style="padding: 12px; display: flex; flex-direction: column; gap: 8px;">
                                ${userTasks.map(t => {
                        const d = new Date(t.date);
                        const dayName = dateHeaders[d.getDay()];
                        return this._renderWeeklyTaskItem(t, `${t.date} (${dayName})`);
                    }).join('')}
                            </div>
                        </div>
                    `;
                });
            }
        }

        html += `
            </div>
          </div>
        `;

        container.innerHTML = html;

        // Events
        container.querySelector('#weekToggleList')?.addEventListener('click', () => {
            this.viewMode = 'list';
            this.render(container);
        });
        container.querySelector('#weekToggleCalendar')?.addEventListener('click', () => {
            this.viewMode = 'calendar';
            this.render(container);
        });
        container.querySelector('#weekExportExcel')?.addEventListener('click', () => {
            this.exportWeeklyToCSV(weeklyTasks, weekDates);
        });
        container.querySelector('#weekGroupToggle')?.addEventListener('change', (e) => {
            this.weeklyGroupMode = e.target.value;
            this.render(container);
        });

        container.querySelectorAll('.week-tab-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                this.weeklyActiveWeekIndex = parseInt(btn.dataset.weekIdx, 10);
                this.render(container);
            });
        });

        container.querySelector('#weekPrevMonth')?.addEventListener('click', () => {
            this.calendarMonth.setMonth(this.calendarMonth.getMonth() - 1);
            this.weeklyActiveWeekIndex = 0; // reset to 1st week of new month
            this.render(container);
        });
        container.querySelector('#weekNextMonth')?.addEventListener('click', () => {
            this.calendarMonth.setMonth(this.calendarMonth.getMonth() + 1);
            this.weeklyActiveWeekIndex = 0; // reset to 1st week of new month
            this.render(container);
        });
    }

    _renderWeeklyTaskItem(t, dateOverride = null) {
        const userName = this.userMap[(t.userid || '').toLowerCase()] || t.userid;
        const statusIcon = t.status === '완료' ? '✅' : (t.status === '진행' ? '🔄' : '⬜');

        return `
            <div style="display: flex; gap: 12px; align-items: flex-start; padding: 8px; background: var(--bg-card-hover); border-radius: 4px;">
                <span style="font-weight: bold; min-width: 80px; color: ${dateOverride ? 'var(--text-muted)' : 'var(--primary)'};">
                    ${dateOverride || userName}
                </span>
                <div style="flex: 1;">
                    <div style="font-weight: 500;">${t.text}</div>
                    ${t.memo ? `<div style="font-size: 0.85rem; color: var(--text-muted); margin-top: 4px;">↳ 비고: ${t.memo}</div>` : ''}
                </div>
                <span style="font-size: 0.85rem; padding: 2px 6px; border-radius: 4px; background: rgba(0,0,0,0.1); white-space:nowrap;">
                    ${statusIcon} ${t.status}
                </span>
            </div>
        `;
    }

    exportWeeklyToCSV(weeklyTasks, weekDates) {
        // Required format: 'ER바이오코어 사업단' Header
        // Columns: '담당자' / '업무 내용' / '비고' / '최종 Status' / '처리 상태' / '월-일-요일'

        let csvContent = '\uFEFF'; // BOM for UTF-8 Excel support
        csvContent += '"ER바이오코어 사업단 주간 업무 보고서"\n\n';
        csvContent += '"담당자","업무 내용","비고","최종 Status","처리 상태","월-일-요일"\n';

        const daysKor = ['일', '월', '화', '수', '목', '금', '토'];

        // Sort tasks based on current group mode
        const sortedTasks = [...weeklyTasks].sort((a, b) => {
            if (this.weeklyGroupMode === 'byDate') {
                return a.date.localeCompare(b.date) || (a.userid || '').localeCompare(b.userid || '');
            } else {
                return (a.userid || '').localeCompare(b.userid || '') || a.date.localeCompare(b.date);
            }
        });

        sortedTasks.forEach(t => {
            const userName = this.userMap[(t.userid || '').toLowerCase()] || t.userid;
            const text = t.text ? t.text.replace(/"/g, '""') : '';
            const memo = t.memo ? t.memo.replace(/"/g, '""') : '';

            const d = new Date(t.date);
            const dateStrFormatted = `${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}-${daysKor[d.getDay()]}`;

            csvContent += `"${userName}","${text}","${memo}","${t.status}","${t.processstatus || ''}","${dateStrFormatted}"\n`;
        });

        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.setAttribute('href', url);
        link.setAttribute('download', `주간업무보고서_${weekDates[0]}_${weekDates[6]}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    }

    // ============================================
    // 대시보드 렌더링
    // ============================================
    async render(container) {
        if (!container) return;
        this.container = container;

        if (this.viewMode === 'calendar') {
            return this.renderCalendar(container);
        }
        if (this.viewMode === 'weekly') {
            return this.renderWeekly(container);
        }

        const isToday = this.isToday();
        const dateDisplay = new Date(this.currentDate + 'T00:00:00').toLocaleDateString('ko-KR', {
            year: 'numeric', month: 'long', day: 'numeric', weekday: 'short'
        });

        const currentTaskInput = container.querySelector('#taskInput')?.value || '';
        const currentTaskDate = container.querySelector('#taskDateInput')?.value || this.currentDate;
        const currentMemoInput = container.querySelector('#dailyCommentInput')?.value || '';

        // 데이터 로드
        const tasks = await this.getTasks();
        const mainStats = this.getStatsByData(tasks);
        const dailyComments = await this._loadComments(this.currentDate);

        // 상단 사용자 필터 칩 구성 (v5.2.29)
        const userChipsHtml = `
            <div class="user-filter-chips">
                <div class="user-chip ${!this.filterUserId || this.filterUserId === '전체' ? 'active' : ''}" data-filter-uid="전체">전체보기</div>
                ${this.allUserIds.map(uid => `
                    <div class="user-chip ${this.filterUserId === uid ? 'active' : ''}" data-filter-uid="${uid}">${this.userMap[uid] || uid}</div>
                `).join('')}
            </div>
        `;

        // ... header and stats 

        // 상태에 따른 정렬: 완료된 것은 아래로
        const sortedTasks = [...tasks].sort((a, b) => {
            if (a.status === '완료' && b.status !== '완료') return 1;
            if (a.status !== '완료' && b.status === '완료') return -1;
            return (a.createdat || '').localeCompare(b.createdat || '');
        });

        // 488: Traceable Timeline Rendering
        const commentsHtml = dailyComments.length === 0 ?
            '<div class="comments-empty">등록된 지시사항이나 비망록이 없습니다.</div>' :
            dailyComments.map((c, idx) => `
                <div class="comment-item ${c.status === 'completed' ? 'completed' : ''}" data-cmt-id="${c.id}">
                    <div class="comment-seq">#${idx + 1}</div>
                    <div class="comment-body">
                        <div style="display:flex; gap:8px; align-items:center; margin-bottom:4px;">
                            ${c.category ? `<span class="category-badge">${c.category}</span>` : ''}
                        </div>
                        <div class="comment-text">${(c.content || '').replace(/\n/g, '<br>')}</div>
                        <div class="comment-meta">
                            👤 ${this.userMap[c.userid] || c.userid} | ${new Date(c.updatedat || c.updatedAt).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })}
                        </div>
                    </div>
                    <div class="comment-actions">
                        <button class="btn-icon c-status-toggle" data-cmt-id="${c.id}" data-status="${c.status || 'pending'}" title="${c.status === 'completed' ? '대기상태로 변경' : '완료처리'}">
                            ${c.status === 'completed' ? '✅' : '⏳'}
                        </button>
                        <button class="btn-icon c-delete-btn" data-cmt-id="${c.id}" title="삭제">🗑️</button>
                    </div>
                </div>
            `).join('');

        container.innerHTML = `
          <div class="tasks-widget">
            <!-- Header, UserChips, Input logic exactly as before but UI is adjusted for Sidebar -->
            <div class="tasks-header">
                <h3 class="tasks-title">📌 팀 업무 대시보드</h3>
                <div class="tasks-date-nav">
                    <button class="btn btn-xs btn-outline" id="taskToggleCalendar">📅 달력보기</button>
                    <button class="btn btn-xs btn-outline" id="taskToggleWeekly">📅 주간보기</button>
                    <button class="tasks-nav-btn" id="taskPrevDate">◀</button>
                    <span class="tasks-date" style="cursor:pointer;" id="taskCurrentDateLabel" title="오늘로 이동">${dateDisplay}</span>
                    <button class="tasks-nav-btn" id="taskNextDate" ${isToday ? 'disabled' : ''}>▶</button>
                    <button class="tasks-nav-btn" id="taskRefreshCloud" title="새로고침">🔄</button>
                </div>
            </div>

            ${userChipsHtml}

            <!-- Task Input Bar -->
            <div class="task-input-row" style="display: flex; gap: 8px; margin-bottom: 15px; background: var(--surface); padding: 12px; border-radius: 8px; box-shadow: 0 1px 3px rgba(0,0,0,0.05); flex-wrap: wrap;">
                <input type="date" id="taskDateInput" class="form-input" style="max-width: 140px;" value="${currentTaskDate}" title="업무 지정일">
                <input type="text" id="taskInput" class="form-input" placeholder="새로운 업무 내역을 입력하세요..." style="flex: 1; min-width:200px;">
                <select id="taskWorkflowLink" class="form-select" style="max-width: 140px;">
                    <option value="">(업무 단계)</option>
                    ${WORKFLOW_STEPS ? WORKFLOW_STEPS.map(s => `<option value="${s.id}">${s.title}</option>`).join('') : ''}
                </select>
                <button class="btn btn-primary" id="taskAddBtn">추가</button>
                <button class="btn btn-outline" id="taskClearCompleted" title="완료된 업무 모두 삭제">🗑 완료정리</button>
            </div>

            <!-- Task List and Summary Sections... -->
            <div class="tasks-list" id="tasksList" style="max-height: 450px; overflow-y: auto; padding-right: 5px;">
                ${this._renderGroupedTasks(sortedTasks, isToday)}
            </div>

            <div class="tasks-comment-area v5-2-31">
                <div class="comment-header">
                    <span class="comment-title">📝 팀 비망록 / 지시사항</span>
                </div>
                <div class="comment-input-row" style="align-items: flex-start;">
                    <textarea id="dailyCommentInput" class="form-input" style="flex:1; resize:vertical; min-height: 60px;" placeholder="비망록이나 지시사항을 입력하세요... (Enter: 등록, Shift+Enter: 줄바꿈)" maxlength="500"></textarea>
                    <button class="btn btn-sm btn-primary" id="btnSaveComment" style="height: 60px;">등록</button>
                </div>
                <div class="comments-timeline">
                    ${commentsHtml}
                </div>
            </div>
          </div>
        `;

        // Restore input values if any
        if (currentTaskInput) {
            const tInput = container.querySelector('#taskInput');
            if (tInput) { tInput.value = currentTaskInput; tInput.focus(); }
        }
        if (currentMemoInput) {
            const mInput = container.querySelector('#dailyCommentInput');
            if (mInput) { mInput.value = currentMemoInput; mInput.focus(); }
        }

        this._bindEvents(container);
    }

    async toggleCommentStatus(cmtId, currentStatus) {
        const newStatus = currentStatus === 'completed' ? 'pending' : 'completed';

        let targetComment = null;
        if (this.supabase) {
            try {
                // Fetch the comment to check its date
                const { data } = await this.supabase.from('task_comments').select('*').eq('id', cmtId).single();
                let updates = { status: newStatus };
                if (data && data.date < this.currentDate) {
                    updates.date = this.currentDate;
                }
                const { error } = await this.supabase.from('task_comments').update(updates).eq('id', cmtId);
                if (!error) this.channel?.send({ type: 'broadcast', event: 'sync-comments', payload: {} }).catch(() => { });
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
                const { error } = await this.supabase.from('task_comments').delete().eq('id', cmtId);
                if (!error) this.channel?.send({ type: 'broadcast', event: 'sync-comments', payload: {} }).catch(() => { });
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
        const lowerTaskUserId = (task.userid || '').toLowerCase();
        const lowerCurrentUserId = this.userid.toLowerCase();
        const isOwn = lowerTaskUserId === lowerCurrentUserId;
        const canEdit = editable;
        const hasMemo = task.memo && task.memo.trim();
        const workflow = task.workflowid ? WORKFLOW_STEPS.find(s => s.id === task.workflowid) : null;

        let badgeClass = '';
        const userName = this.userMap[lowerTaskUserId] || lowerTaskUserId;
        if (userName === '이은지') badgeClass = ' badge-eunji';
        else if (userName === '박선영') badgeClass = ' badge-seonyoung';
        else if (isOwn) badgeClass = ' own';

        const processOptions = PROCESS_STATUS_OPTIONS.map(opt =>
            `<option value="${opt}" ${task.processstatus === opt ? 'selected' : ''}>${opt || '(Status)'}</option>`
        ).join('');

        return `
      <div class="task-item ${statusClass[task.status]}" data-id="${task.id}" data-owner="${task.userid}">
        <button class="task-status-btn ${statusClass[task.status]}" data-action="cycle" data-id="${task.id}" data-owner="${task.userid}" title="상태 변경">
          ${statusIcons[task.status]}
        </button>
        <div class="task-main-content">
          <div class="task-meta-top">
            <span class="task-author-badge ${badgeClass.trim()}">${userName}</span>
            ${workflow ? `<span class="task-workflow-badge">🔗 ${workflow.title}</span>` : ''}
            <select class="task-process-select" data-id="${task.id}" data-owner="${task.userid}" title="업무 처리 상태">
              ${processOptions}
            </select>
            <span class="task-full-time" title="생성 일시">${task.createdatfull || task.createdat}</span>
          </div>
          <div class="task-text-row">
            <span class="task-text ${task.status === '완료' ? 'completed' : ''}">${task.text}</span>
          </div>
        </div>
        <button class="task-memo-btn ${hasMemo ? 'has-memo' : ''}" data-action="memo" data-id="${task.id}" data-owner="${task.userid}" title="${hasMemo ? task.memo : '비고 추가'}">
          ${hasMemo ? '💬' : '📝'}
        </button>
        ${canEdit ? `
        <button class="task-edit-btn" data-action="edit" data-id="${task.id}" data-owner="${task.userid}" title="수정">✏️</button>
        <button class="task-delete-btn" data-action="delete" data-id="${task.id}" data-owner="${task.userid}" title="삭제">🗑</button>
        ` : ''}
      </div>
      ${hasMemo ? `<div class="task-memo-display" data-memo-for="${task.id}"><span class="memo-label">비고:</span> ${(task.memo || '').replace(/\n/g, '<br>')}</div>` : ''}`;
    }

    _renderGroupedTasks(tasks, editable) {
        if (tasks.length === 0) return '<div class="tasks-empty">데이터가 없습니다.</div>';

        const groups = {};
        tasks.forEach(t => {
            const cat = t.category || '일반';
            if (!groups[cat]) groups[cat] = [];
            groups[cat].push(t);
        });

        const sortedCats = Object.keys(groups).sort((a, b) => {
            if (a === '일반') return 1;
            if (b === '일반') return -1;
            return a.localeCompare(b);
        });

        return sortedCats.map(cat => `
            <div class="task-group">
                <div class="task-group-header">${cat}</div>
                <div class="task-group-items">
                    ${groups[cat].map(t => this._renderTask(t, editable)).join('')}
                </div>
            </div>
        `).join('');
    }

    _bindEvents(container) {
        // 업무 추가
        const input = container.querySelector('#taskInput');
        const dateInput = container.querySelector('#taskDateInput');
        const workflowSelect = container.querySelector('#taskWorkflowLink');
        const addBtn = container.querySelector('#taskAddBtn');
        if (input && addBtn) {
            const addTask = async () => {
                if (input.value.trim()) {
                    await this.addTask(input.value, workflowSelect?.value || '', dateInput?.value || this.currentDate);
                    // Clear input state strictly
                    input.value = '';
                    this.render(container);
                }
            };
            addBtn.addEventListener('click', addTask);
            input.addEventListener('keydown', e => { if (e.key === 'Enter') addTask(); });
        }

        const clearBtn = container.querySelector('#taskClearCompleted');
        if (clearBtn) {
            clearBtn.addEventListener('click', async () => {
                const tasks = await this._load(this.currentDate);
                const completedIds = tasks.filter(t => t.status === '완료').map(t => t.id);
                if (completedIds.length === 0) {
                    return window.app?.showToast('🗑 정리할 완료된 업무가 없습니다.', 'info');
                }
                if (confirm(`완료된 업무 ${completedIds.length}건을 모두 삭제하시겠습니까?`)) {
                    if (this.supabase) {
                        await this.supabase.from('tasks').delete().in('id', completedIds);
                    } else {
                        const filtered = tasks.filter(t => t.status !== '완료');
                        await this._save(filtered, this.currentDate);
                    }
                    window.app?.showToast('✨ 완료된 업무가 일괄 정리되었습니다.', 'success');
                    this.render(container);
                }
            });
        }

        // 상태 변경, 삭제, 개별 메모
        container.querySelectorAll('[data-action]').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const action = btn.dataset.action;
                const id = btn.dataset.id;
                const owner = btn.dataset.owner || this.userid;

                if (action === 'cycle') {
                    this.cycleStatus(id, owner).then(() => this.render(container));
                } else if (action === 'edit') {
                    e.stopPropagation();
                    this._showTaskEditor(container, id, owner);
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

        // 업무 처리 상태 (Process Status) 변경
        container.querySelectorAll('.task-process-select').forEach(select => {
            select.addEventListener('change', async (e) => {
                const taskId = select.dataset.id;
                const ownerId = select.dataset.owner;
                const newStatus = e.target.value;
                await this.updateProcessStatus(taskId, newStatus, ownerId);
                window.app?.showToast('✨ 처리 상태가 업데이트되었습니다.', 'success');
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
            commentInput.addEventListener('keydown', e => {
                if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    saveComment();
                }
            });
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

        // 날짜 탐색 및 레이아웃 전환
        container.querySelector('#taskToggleCalendar')?.addEventListener('click', () => {
            this.viewMode = 'calendar';
            this.calendarMonth = new Date(this.currentDate);
            this.render(container);
        });
        container.querySelector('#taskToggleWeekly')?.addEventListener('click', () => {
            this.viewMode = 'weekly';
            this.render(container);
        });
        container.querySelector('#taskCurrentDateLabel')?.addEventListener('click', () => {
            if (this.currentDate !== this._todayStr()) {
                this.currentDate = this._todayStr();
                this.render(container);
            }
        });
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
      <textarea class="task-memo-input form-input" placeholder="비고 내용을 입력하세요... (Enter: 저장, Shift+Enter: 줄바꿈)" maxlength="200" style="width: 100%; resize: vertical; min-height: 60px; margin-bottom: 8px;">${currentMemo}</textarea>
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
        memoInput.addEventListener('keydown', e => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                saveMemo();
            }
        });
        editor.querySelector('.task-memo-cancel').addEventListener('click', () => editor.remove());
    }

    async _showTaskEditor(container, taskId, ownerId) {
        const tasks = await this._load(this.currentDate);
        const task = tasks.find(t => t.id === taskId);
        if (!task) return;

        const existingEditor = container.querySelector('.task-content-editor');
        if (existingEditor) existingEditor.remove();

        const taskItem = container.querySelector(`[data-id="${taskId}"].task-item`);
        if (!taskItem) return;

        const editor = document.createElement('div');
        editor.className = 'task-content-editor';
        editor.style.cssText = 'padding: 10px; background: var(--bg-card-hover); border-radius: 6px; margin: 4px 0; display: flex; gap: 8px; align-items: center; border: 1px solid var(--primary);';

        const wfOptions = `<option value="">(업무 단계)</option>` +
            (WORKFLOW_STEPS || []).map(s => `<option value="${s.id}" ${s.id === task.workflowid ? 'selected' : ''}>${s.title}</option>`).join('');

        editor.innerHTML = `
      <input type="text" class="task-edit-text-input form-input" value="${task.text.replace(/"/g, '&quot;')}" placeholder="업무 내용 수정..." style="flex: 1;">
      <select class="task-edit-wf-input form-select" style="max-width: 140px;">
          ${wfOptions}
      </select>
      <div class="editor-actions" style="display: flex; gap: 4px;">
        <button class="btn btn-xs btn-primary task-edit-save">저장</button>
        <button class="btn btn-xs btn-outline task-edit-cancel">취소</button>
      </div>
    `;

        taskItem.parentNode.insertBefore(editor, taskItem.nextSibling);
        taskItem.style.display = 'none';

        const textInput = editor.querySelector('.task-edit-text-input');
        const wfInput = editor.querySelector('.task-edit-wf-input');
        textInput.focus();

        const closeEditor = () => {
            taskItem.style.display = '';
            editor.remove();
        };

        const saveTask = async () => {
            if (!textInput.value.trim()) {
                window.app?.showToast('업무 내용을 입력해주세요.', 'warning');
                return;
            }
            await this.updateTask(taskId, textInput.value.trim(), wfInput.value, ownerId);
            closeEditor();
            this.render(container);
        };

        editor.querySelector('.task-edit-save').addEventListener('click', saveTask);
        textInput.addEventListener('keydown', e => { if (e.key === 'Enter') saveTask(); });
        editor.querySelector('.task-edit-cancel').addEventListener('click', closeEditor);
    }
}

export { TaskManager };
