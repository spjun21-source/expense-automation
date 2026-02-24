import { initSupabase } from './supabase.js';

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
        this.supabase = initSupabase();
        this._session = this._loadSession();
        this._cachedUsers = [];
        this.bootstrapReady = this._initBootstrap(); // Track bootstrap
    }

    async _initBootstrap() {
        if (!this.supabase) return;
        try {
            // 1. admin 계정 존재 여부 확인
            const { data: adminUser, error: checkError } = await this.supabase
                .from('users')
                .select('id')
                .eq('id', 'admin')
                .maybeSingle();

            if (checkError) throw checkError;

            // 2. admin이 없으면 기본 계정들 로드
            if (!adminUser) {
                console.log('🚀 [Auth] Admin missing. Bootstrapping cloud users...');
                const { count } = await this.supabase.from('users').select('*', { count: 'exact', head: true });

                if (count === 0) {
                    await this.supabase.from('users').insert(DEFAULT_USERS);
                    console.log('✅ [Auth] All default users added to cloud.');
                } else {
                    await this.supabase.from('users').insert(DEFAULT_USERS.find(u => u.id === 'admin'));
                    console.log('✅ [Auth] Admin account restored in cloud.');
                }
            } else {
                console.log('✅ [Auth] Admin account verified in cloud.');
            }
        } catch (e) {
            console.error('❌ [Auth] Bootstrap failed (Network Error?):', e.message);
            // 부트스트랩 실패 시에도 앱은 계속 진행 (로컬 모드)
        }
    }

    async _getCloudUsers() {
        if (!this.supabase) return this._getLocalUsers();
        try {
            const { data, error } = await this.supabase.from('users').select('*');
            if (error) throw error;
            this._cachedUsers = data;
            // Sync to local
            localStorage.setItem(STORAGE_KEYS.USERS, JSON.stringify(data));
            return data;
        } catch (e) {
            return this._getLocalUsers();
        }
    }

    _getLocalUsers() {
        try {
            return JSON.parse(localStorage.getItem(STORAGE_KEYS.USERS) || '[]');
        } catch { return []; }
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
    async login(userId, password) {
        let user = null;
        let systemError = null;

        if (this.supabase) {
            try {
                const { data, error } = await this.supabase
                    .from('users')
                    .select('*')
                    .eq('id', userId)
                    .eq('password', password)
                    .maybeSingle(); // single() 대신 maybeSingle()로 에러 분리

                if (error) {
                    console.error('❌ [Auth] Supabase Login Error:', error);
                    // 'TypeError: Failed to fetch' 등 모든 fetch 관련 오류 포함
                    if (error.message && error.message.toLowerCase().includes('fetch')) {
                        throw new Error('Network failure');
                    }
                    systemError = `시스템 오류: ${error.message}`;
                } else if (data) {
                    user = data;
                }
            } catch (err) {
                console.error('❌ [Auth] Fatal Login Exception (Absolute Fallback):', err);
                // 1. LocalStorage 확인
                const localUsers = this._getLocalUsers();
                user = localUsers.find(u => u.id === userId && u.password === password);

                // 2. LocalStorage에도 없으면 DEFAULT_USERS (하드코딩된 기본값) 확인
                if (!user) {
                    user = DEFAULT_USERS.find(u => u.id === userId && u.password === password);
                }

                if (!user) systemError = '네트워크 연결 실패 및 유효한 계정 정보 정합성 오류';
            }
        } else {
            const users = this._getLocalUsers().length > 0 ? this._getLocalUsers() : DEFAULT_USERS;
            user = users.find(u => u.id === userId && u.password === password);
        }

        if (systemError && !user) return { success: false, error: systemError };
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
    async register(userId, password, name, dept, role = 'user') {
        if (!this.isAdmin()) return { success: false, error: '관리자 권한이 필요합니다.' };

        const newUser = { id: userId, password, name, dept, role };

        if (this.supabase) {
            const { error } = await this.supabase.from('users').insert(newUser);
            if (error) return { success: false, error: '이미 존재하는 아이디이거나 오류가 발생했습니다.' };
        } else {
            const users = this._getLocalUsers();
            if (users.find(u => u.id === userId)) return { success: false, error: '이미 존재하는 아이디입니다.' };
            users.push(newUser);
            localStorage.setItem(STORAGE_KEYS.USERS, JSON.stringify(users));
        }
        return { success: true };
    }

    async deleteUser(userId) {
        if (!this.isAdmin()) return { success: false, error: '관리자 권한이 필요합니다.' };
        if (userId === 'admin') return { success: false, error: '기본 관리자는 삭제할 수 없습니다.' };

        if (this.supabase) {
            await this.supabase.from('users').delete().eq('id', userId);
        } else {
            const users = this._getLocalUsers().filter(u => u.id !== userId);
            localStorage.setItem(STORAGE_KEYS.USERS, JSON.stringify(users));
        }
        return { success: true };
    }

    async getUsers() {
        try {
            const users = await this._getCloudUsers();
            if (!users || users.length === 0) throw new Error('Empty user list');
            return users.map(({ password, ...rest }) => rest);
        } catch (e) {
            console.warn('⚠️ [Auth] Using local fallback for user list:', e.message);
            // 최소한 자기 자신은 포함된 리스트 반환
            const local = this._getLocalUsers();
            if (local.length > 0) return local.map(({ password, ...rest }) => rest);

            // 진짜 아무것도 없으면 하드코딩된 기본값에서 현재 유저라도 반환
            const current = this.getCurrentUser();
            return current ? [current] : DEFAULT_USERS.map(({ password, ...rest }) => rest);
        }
    }

    async updateUser(userId, data) {
        if (!this.isAdmin()) return { success: false, error: '관리자 권한이 필요합니다.' };

        if (this.supabase) {
            const { error } = await this.supabase
                .from('users')
                .update({
                    ...data,
                    updatedAt: new Date().toISOString()
                })
                .eq('id', userId);
            if (error) return { success: false, error: '수정 중 오류가 발생했습니다.' };
        } else {
            const users = this._getLocalUsers();
            const index = users.findIndex(u => u.id === userId);
            if (index === -1) return { success: false, error: '사용자를 찾을 수 없습니다.' };
            if (data.name) users[index].name = data.name;
            if (data.dept) users[index].dept = data.dept;
            if (data.role) users[index].role = data.role;
            if (data.password) users[index].password = data.password;
            localStorage.setItem(STORAGE_KEYS.USERS, JSON.stringify(users));
        }
        return { success: true };
    }

    getUserCount() {
        return this._getUsers().length;
    }
}

export { AuthManager };
