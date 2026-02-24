// ============================================================
// 사업단 경비 처리 자동화 - Supabase Cloud Bridge
// ============================================================

/**
 * [가이드] 아래 URL과 Key에 Supabase 프로젝트 정보를 입력해주세요.
 * 프로젝트 생성 후 Settings > API 메뉴에서 확인 가능합니다.
 */
const SUPABASE_CONFIG = {
    URL: 'https://uiffoznjdltiqxwhiwi.supabase.co',
    ANON_KEY: 'sb_publishable_9K7CY3Ov5PSrcmUiKGFpEA_IGAqnwun'
};

// Supabase 클라이언트 초기화 (CDN 로드 후 실행됨)
let supabase = null;

function initSupabase() {
    if (typeof supabasejs === 'undefined') {
        console.error('Supabase SDK not loaded yet.');
        return null;
    }

    // Placeholder 체크
    if (SUPABASE_CONFIG.URL === 'YOUR_SUPABASE_PROJECT_URL') {
        console.warn('Supabase URL/Key가 설정되지 않았습니다. 로컬 모드로 동작합니다.');
        return null;
    }

    try {
        supabase = supabasejs.createClient(SUPABASE_CONFIG.URL, SUPABASE_CONFIG.ANON_KEY);
        console.log('✅ Supabase Cloud Connected');
        return supabase;
    } catch (e) {
        console.error('Supabase Connection Error:', e);
        return null;
    }
}

export { initSupabase, supabase };
