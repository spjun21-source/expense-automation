// ============================================================
// 사업단 경비 처리 자동화 - Supabase Cloud Bridge
// ============================================================
console.log('📦 [supabase.js] Module initialized');

/**
 * [가이드] 아래 URL과 Key에 Supabase 프로젝트 정보를 입력해주세요.
 * 프로젝트 생성 후 Settings > API 메뉴에서 확인 가능합니다.
 */
const SUPABASE_CONFIG = {
    URL: 'https://uiffoznfjdltiqxwhiwi.supabase.co',
    ANON_KEY: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVpZmZvem5mamRsdGlxeHdoaXdpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE5MDg3NjEsImV4cCI6MjA4NzQ4NDc2MX0.aBthoW9n9YiC0zYKgSMBToJkDu2uLb9BPPVb2RNHB0Y'
};

// Supabase 클라이언트 인스턴스
let supabaseClient = null;

function initSupabase() {
    // 1. 이미 클라이언트가 생성되어 있다면 재사용 (싱글톤)
    if (supabaseClient) return supabaseClient;

    // 2. CDN에서 로드된 전역 supabase 객체 확인
    if (typeof window.supabase === 'undefined') {
        console.error('Supabase SDK not loaded yet. Check index.html script tag.');
        return null;
    }

    // 3. Placeholder 체크
    if (SUPABASE_CONFIG.URL === 'YOUR_SUPABASE_PROJECT_URL' || !SUPABASE_CONFIG.URL) {
        console.warn('Supabase URL/Key가 설정되지 않았습니다. 로컬 모드로 동작합니다.');
        return null;
    }

    try {
        // 전역 객체(window.supabase)로부터 클라이언트 생성
        supabaseClient = window.supabase.createClient(SUPABASE_CONFIG.URL, SUPABASE_CONFIG.ANON_KEY);
        console.log('✅ [Supabase] Singleton Client Initialized');
        return supabaseClient;
    } catch (e) {
        console.error('Supabase Connection Error:', e);
        return null;
    }
}

export { initSupabase, supabaseClient as supabase };
