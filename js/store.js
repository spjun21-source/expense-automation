// ============================================================
// 사업단 경비 처리 자동화 - Document Store Module (v5)
// ============================================================

const DOC_STORAGE_KEY = 'expense_documents';

class DocumentStore {
    constructor() {
        this._docs = this._load();
    }

    _load() {
        try {
            return JSON.parse(localStorage.getItem(DOC_STORAGE_KEY) || '[]');
        } catch { return []; }
    }

    _persist() {
        localStorage.setItem(DOC_STORAGE_KEY, JSON.stringify(this._docs));
    }

    _genId() {
        return 'doc_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6);
    }

    // ---- CRUD ----
    save(formType, data, author) {
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
            approvedAt: ''
        };
        this._docs.push(doc);
        this._persist();
        return doc;
    }

    update(docId, newData) {
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
        this._persist();
        return { success: true, doc };
    }

    delete(docId) {
        const doc = this._docs.find(d => d.id === docId);
        if (!doc) return { success: false, error: '문서를 찾을 수 없습니다.' };
        if (doc.status !== '작성중') {
            return { success: false, error: `'${doc.status}' 상태의 문서는 삭제할 수 없습니다.` };
        }
        this._docs = this._docs.filter(d => d.id !== docId);
        this._persist();
        return { success: true };
    }

    submit(docId) {
        const doc = this._docs.find(d => d.id === docId);
        if (!doc) return { success: false, error: '문서를 찾을 수 없습니다.' };
        if (doc.status !== '작성중') {
            return { success: false, error: `'${doc.status}' 상태에서는 제출할 수 없습니다.` };
        }
        doc.status = '제출';
        doc.updatedAt = new Date().toISOString();
        this._persist();
        return { success: true, doc };
    }

    // ---- 결재 처리 ----
    approve(docId, adminUser, comment = '') {
        const doc = this._docs.find(d => d.id === docId);
        if (!doc) return { success: false, error: '문서를 찾을 수 없습니다.' };
        if (doc.status !== '제출') return { success: false, error: '제출 상태의 문서만 승인할 수 있습니다.' };
        doc.status = '승인';
        doc.approvedBy = adminUser.name;
        doc.approvedAt = new Date().toISOString();
        doc.approvalComment = comment;
        doc.updatedAt = new Date().toISOString();
        this._persist();
        return { success: true, doc };
    }

    reject(docId, adminUser, comment = '') {
        const doc = this._docs.find(d => d.id === docId);
        if (!doc) return { success: false, error: '문서를 찾을 수 없습니다.' };
        if (doc.status !== '제출') return { success: false, error: '제출 상태의 문서만 반려할 수 있습니다.' };
        doc.status = '반려';
        doc.approvedBy = adminUser.name;
        doc.approvedAt = new Date().toISOString();
        doc.approvalComment = comment;
        doc.updatedAt = new Date().toISOString();
        this._persist();
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
