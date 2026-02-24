// ============================================================
// 사업단 경비 처리 자동화 - Auth Module (v5)
// ============================================================

const DEFAULT_USERS = [
    { id: 'admin', password: 'admin1234', name: '관리자', dept: '사업단', role: 'admin' },
    { id: 'user01', password: 'user1234', name: '사용자1', dept: '연구팀', role: 'user' },
    { id: 'user02', password: 'user2345', name: '사용자2', dept: '재무팀', role: 'user' },
    { id: 'user03', password: 'user3456', name: '사용자3', dept: '임상팀', role: 'user' }
];

const STORAGE_KEYS = {
    USERS: 'expense_users',
    SESSION: 'expense_session'
};

class AuthManager {
    constructor() {
        this._initDefaults();
        this._session = this._loadSession();
    }

    // ---- 초기화: 기본 계정 등록 ----
    _initDefaults() {
        const existing = this._getUsers();
        if (existing.length === 0) {
            localStorage.setItem(STORAGE_KEYS.USERS, JSON.stringify(DEFAULT_USERS));
        }
    }

    _getUsers() {
        try {
            return JSON.parse(localStorage.getItem(STORAGE_KEYS.USERS) || '[]');
        } catch { return []; }
    }

    _saveUsers(users) {
        localStorage.setItem(STORAGE_KEYS.USERS, JSON.stringify(users));
    }

    _loadSession() {
        try {
            return JSON.parse(localStorage.getItem(STORAGE_KEYS.SESSION) || 'null');
        } catch { return null; }
    }

    _saveSession(user) {
        const session = user ? { id: user.id, name: user.name, dept: user.dept, role: user.role } : null;
        localStorage.setItem(STORAGE_KEYS.SESSION, JSON.stringify(session));
        this._session = session;
    }

    // ---- 공개 API ----
    login(userId, password) {
        const users = this._getUsers();
        const user = users.find(u => u.id === userId && u.password === password);
        if (!user) return { success: false, error: '아이디 또는 비밀번호가 올바르지 않습니다.' };
        this._saveSession(user);
        return { success: true, user: this._session };
    }

    logout() {
        this._saveSession(null);
    }

    getCurrentUser() {
        return this._session;
    }

    isLoggedIn() {
        return this._session !== null;
    }

    isAdmin() {
        return this._session?.role === 'admin';
    }

    // ---- 관리자: 사용자 관리 ----
    register(userId, password, name, dept, role = 'user') {
        if (!this.isAdmin()) return { success: false, error: '관리자 권한이 필요합니다.' };
        const users = this._getUsers();
        if (users.find(u => u.id === userId)) return { success: false, error: '이미 존재하는 아이디입니다.' };
        users.push({ id: userId, password, name, dept, role });
        this._saveUsers(users);
        return { success: true };
    }

    deleteUser(userId) {
        if (!this.isAdmin()) return { success: false, error: '관리자 권한이 필요합니다.' };
        if (userId === 'admin') return { success: false, error: '기본 관리자는 삭제할 수 없습니다.' };
        const users = this._getUsers().filter(u => u.id !== userId);
        this._saveUsers(users);
        return { success: true };
    }

    getUsers() {
        return this._getUsers().map(({ password, ...rest }) => rest);
    }

    updateUser(userId, data) {
        if (!this.isAdmin()) return { success: false, error: '관리자 권한이 필요합니다.' };
        const users = this._getUsers();
        const index = users.findIndex(u => u.id === userId);
        if (index === -1) return { success: false, error: '사용자를 찾을 수 없습니다.' };

        // Update fields if provided
        if (data.name) users[index].name = data.name;
        if (data.dept) users[index].dept = data.dept;
        if (data.role) users[index].role = data.role;
        if (data.password) users[index].password = data.password;

        this._saveUsers(users);
        return { success: true };
    }

    getUserCount() {
        return this._getUsers().length;
    }
}

export { AuthManager };
