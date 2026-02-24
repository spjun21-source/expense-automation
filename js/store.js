import { supabase, initSupabase } from './supabase.js';

const DOC_STORAGE_KEY = 'expense_documents';

class DocumentStore {
    constructor() {
        this.supabase = initSupabase();
        this._docs = this._loadLocal();
        this._setupRealtime();
        this.ready = this._loadCloud(); // Capture the promise
    }

    async _withTimeout(promise, ms = 2000, name = 'Store Query') {
        return Promise.race([
            promise,
            new Promise((_, reject) => setTimeout(() => reject(new Error(`${name} Timeout`)), ms))
        ]);
    }

    _setupRealtime() {
        if (!this.supabase) return;
        this.supabase
            .channel('public:documents')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'documents' }, async payload => {
                console.log('🔄 Document Sync Received:', payload);
                await this._loadCloud();
                window.dispatchEvent(new CustomEvent('docs-updated'));
            })
            .subscribe();
    }

    _loadLocal() {
        try {
            const local = JSON.parse(localStorage.getItem(DOC_STORAGE_KEY) || '[]');
            return local.map(d => ({
                ...d,
                createdat: d.createdat || d.createdAt || new Date().toISOString(),
                updatedat: d.updatedat || d.updatedAt || new Date().toISOString()
            })).sort((a, b) => (b.updatedat || '').localeCompare(a.updatedat || ''));
        } catch (e) {
            console.error('Local Load Error:', e);
            return [];
        }
    }

    async _loadCloud() {
        if (!this.supabase) return;
        try {
            const { data, error } = await this._withTimeout(
                this.supabase.from('documents')
                    .select('*')
                    .order('updatedat', { ascending: false }),
                2000, 'Store Load'
            );
            if (!error && data) {
                this._docs = data;
                // Sync to local for offline/fallback
                localStorage.setItem(DOC_STORAGE_KEY, JSON.stringify(this._docs));
            }
        } catch (e) {
            console.warn('⚠️ [Store] Cloud load failed, using local fallback:', e.message);
        }
    }

    async _persist(doc) {
        // Local persist (full list)
        localStorage.setItem(DOC_STORAGE_KEY, JSON.stringify(this._docs));

        // Cloud persist (individual document upsert)
        if (this.supabase) {
            try {
                const { error } = await this.supabase
                    .from('documents')
                    .upsert({
                        ...doc,
                        updatedat: new Date().toISOString()
                    });
                if (error) console.error('Cloud Sync Error:', error);
            } catch (e) {
                console.error('Cloud Save Fatal:', e);
            }
        }
    }

    _genId() {
        return 'doc_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6);
    }

    // ---- CRUD ----
    async save(formType, data, author) {
        const doc = {
            id: this._genId(),
            formType,
            data: { ...data },
            status: '작성중',
            authorId: author.id,
            authorName: author.name,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            approvalComment: '',
            approvedBy: '',
            approvedAt: null
        };
        this._docs.push(doc);
        await this._persist(doc);
        return doc;
    }

    async update(docId, newData) {
        const doc = this._docs.find(d => d.id === docId);
        if (!doc) return { success: false, error: '문서를 찾을 수 없습니다.' };
        if (doc.status !== '작성중' && doc.status !== '반려') {
            return { success: false, error: `'${doc.status}' 상태의 문서는 수정할 수 없습니다.` };
        }
        doc.data = { ...newData };
        doc.updatedAt = new Date().toISOString();
        if (doc.status === '반려') {
            doc.status = '작성중';
            doc.approvalComment = '';
        }
        await this._persist(doc);
        return { success: true, doc };
    }

    async delete(docId) {
        const doc = this._docs.find(d => d.id === docId);
        if (!doc) return { success: false, error: '문서를 찾을 수 없습니다.' };
        if (doc.status !== '작성중') {
            return { success: false, error: `'${doc.status}' 상태의 문서는 삭제할 수 없습니다.` };
        }

        if (this.supabase) {
            const { error } = await this.supabase.from('documents').delete().eq('id', docId);
            if (error) return { success: false, error: '삭제 중 오류가 발생했습니다.' };
        }

        this._docs = this._docs.filter(d => d.id !== docId);
        localStorage.setItem(DOC_STORAGE_KEY, JSON.stringify(this._docs));
        return { success: true };
    }

    async submit(docId) {
        const doc = this._docs.find(d => d.id === docId);
        if (!doc) return { success: false, error: '문서를 찾을 수 없습니다.' };
        if (doc.status !== '작성중') {
            return { success: false, error: `'${doc.status}' 상태에서는 제출할 수 없습니다.` };
        }
        doc.status = '제출';
        doc.updatedAt = new Date().toISOString();
        await this._persist(doc);
        return { success: true, doc };
    }

    // ---- 결재 처리 ----
    async approve(docId, adminUser, comment = '') {
        const doc = this._docs.find(d => d.id === docId);
        if (!doc) return { success: false, error: '문서를 찾을 수 없습니다.' };
        if (doc.status !== '제출') return { success: false, error: '제출 상태의 문서만 승인할 수 있습니다.' };
        doc.status = '승인';
        doc.approvedBy = adminUser.name;
        doc.approvedAt = new Date().toISOString();
        doc.approvalComment = comment;
        doc.updatedAt = new Date().toISOString();
        await this._persist(doc);
        return { success: true, doc };
    }

    async reject(docId, adminUser, comment = '') {
        const doc = this._docs.find(d => d.id === docId);
        if (!doc) return { success: false, error: '문서를 찾을 수 없습니다.' };
        if (doc.status !== '제출') return { success: false, error: '제출 상태의 문서만 반려할 수 있습니다.' };
        doc.status = '반려';
        doc.approvedBy = adminUser.name;
        doc.approvedAt = new Date().toISOString();
        doc.approvalComment = comment;
        doc.updatedAt = new Date().toISOString();
        await this._persist(doc);
        return { success: true, doc };
    }

    // ---- 조회 ----
    getById(docId) {
        return this._docs.find(d => d.id === docId) || null;
    }

    getByUser(userId) {
        return this._docs.filter(d => d.authorId === userId).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
    }

    getAll() {
        return [...this._docs].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
    }

    getPending() {
        return this._docs.filter(d => d.status === '제출').sort((a, b) => a.updatedAt.localeCompare(b.updatedAt));
    }

    getPendingCount() {
        return this._docs.filter(d => d.status === '제출').length;
    }

    // ---- 기간 + 상태 필터 ----
    getFiltered({ startDate, endDate, status, userId } = {}) {
        return this._docs.filter(d => {
            if (userId && d.authorId !== userId) return false;
            if (status && status !== '전체' && d.status !== status) return false;
            if (startDate) {
                const docDate = d.createdAt.split('T')[0];
                if (docDate < startDate) return false;
            }
            if (endDate) {
                const docDate = d.createdAt.split('T')[0];
                if (docDate > endDate) return false;
            }
            return true;
        }).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
    }
}

export { DocumentStore };
