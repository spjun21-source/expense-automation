// ============================================================
// 사업단 경비 처리 자동화 - 데이터 모듈 (v2 - 인수인계서 매칭)
// ============================================================

// 엑셀 컬럼 정의 (2025년 지출내역 양식 기준)
const EXCEL_COLUMNS = [
    { key: 'no', label: 'NO', width: 40 },
    { key: 'scheduledDate', label: '지출예정일자', width: 100 },
    { key: 'transferDate', label: '이체일자', width: 100 },
    { key: 'description', label: '지출내역', width: 250 },
    { key: 'amount', label: '지출금액', width: 100, type: 'number' },
    { key: 'actualAmount', label: '실지출금액', width: 100, type: 'number' },
    { key: 'fromBank', label: '출금은행명', width: 80 },
    { key: 'fromAccount', label: '출금계좌', width: 130 },
    { key: 'payee', label: '지급처', width: 120 },
    { key: 'toBank', label: '입금은행명', width: 80 },
    { key: 'toAccount', label: '입금계좌', width: 130 },
    { key: 'processType', label: '처리유형', width: 100 },
    { key: 'fundSource', label: '재원', width: 60 },
    { key: 'expenseCategory', label: '지출비목', width: 100 },
    { key: 'subCategory', label: '세세목', width: 200 },
    { key: 'evidenceDate', label: '증빙일자', width: 100 },
    { key: 'supplyAmount', label: '공급가액', width: 100, type: 'number' },
    { key: 'vatAmount', label: '부가세액', width: 80, type: 'number' },
    { key: 'status', label: '진행구분', width: 60 },
    { key: 'vendor', label: '구입처', width: 120 },
    { key: 'accountingDate', label: '회계전송(예정)일', width: 120 },
    { key: 'docNumber', label: '문서번호', width: 200 },
    { key: 'resolutionNumber', label: '결의번호', width: 200 }
];

// 인수인계서 기반 업무 절차 (v3 - 시스템 표기 + 수입 처리 보완)
// ★ 각 단계에 접속 시스템을 명시 (절차별로 사용 시스템이 다름)
const WORKFLOW_STEPS = [
    // ========================================
    // 그룹 R1: 국가연구개발혁신법 규정 이해
    // ========================================
    {
        id: 'regulation_overview',
        order: -2,
        group: 'regulation',
        groupTitle: 'R1. 국가연구개발혁신법 규정 이해',
        title: '국가연구개발혁신법 개요 및 목적',
        icon: '⚖️',
        system: '법령 참조 (law.go.kr)',
        systemUrl: 'https://www.law.go.kr',
        description: '국가연구개발혁신법(2021.1.1 시행)의 목적과 핵심 원칙을 이해합니다. 부처별 상이한 규정을 통합하여 연구자 행정 부담을 경감하고 자율·책임 연구 환경을 조성합니다.',
        refPage: '국가연구개발혁신법 제1조~제5조',
        details: [
            '📋 법률 목적: 국가연구개발사업 추진 체계 혁신, 자율적·책임 있는 연구환경 조성',
            '기존 부처별 상이한 R&D 관리 규정을 통합·체계화',
            '연구자 권리 보장: 연구 자율성, 연구윤리, 연구부정 방지',
            '연구비 사용의 투명성과 효율성 확보',
            '⚠️ 2021년 1월 1일 시행 — 모든 국가 R&D 과제에 적용',
            '핵심 키워드: 자율 → 책임 → 성과'
        ],
        requiredDocs: [],
        relatedDocs: [],
        quiz: {
            question: '국가연구개발혁신법의 주요 시행 목적은?',
            options: ['연구비 삭감', '부처별 규정 통합 및 연구자 행정 부담 경감', '특정 부처 연구비 증액', '해외 연구기관 지원'],
            answer: 1
        }
    },
    {
        id: 'regulation_budget_structure',
        order: -1.9,
        group: 'regulation',
        title: '연구비 비목 구조 (직접비 / 간접비)',
        icon: '📊',
        system: '법령 참조',
        systemUrl: '',
        description: '국가연구개발혁신법에 따른 연구비 비목 분류 체계(직접비·간접비)를 이해합니다.',
        refPage: '혁신법 제13조, 시행령 제29조',
        details: [
            '📌 연구비 = 직접비 + 간접비',
            '',
            '▶ 직접비 (과제에 직접 소요되는 비용):',
            '  ① 인건비: 참여연구자 급여, 4대보험, 퇴직충당금',
            '  ② 학생인건비: 학생 연구자 인건비',
            '  ③ 연구시설·장비비: 구입/설치/임차/운영·유지비',
            '  ④ 연구재료비: 연구 수행 재료 구입비',
            '  ⑤ 연구활동비: 출장여비, 회의비, 사무용품비, 전문가 활용비 등',
            '  ⑥ 연구수당: 참여연구자 장려금 (수정인건비 20% 이내)',
            '  ⑦ 위탁연구개발비: 외부기관 위탁 연구비',
            '',
            '▶ 간접비 (공통적으로 소요되는 비용):',
            '  ① 인력지원비 ② 연구지원비 ③ 성과활용지원비',
            '',
            '⚠️ 직접비↔간접비 교차 집행 시 불인정 처분 가능!',
            '단, 직접비 내 세목 간 오집행은 불인정하지 않음 (최근 완화)'
        ],
        requiredDocs: [],
        relatedDocs: [],
        quiz: {
            question: '다음 중 \"직접비\"에 해당하지 않는 항목은?',
            options: ['연구재료비', '연구활동비', '성과활용지원비', '연구시설·장비비'],
            answer: 2
        }
    },
    {
        id: 'regulation_compliance',
        order: -1.8,
        group: 'regulation',
        title: '연구비 사용 시 주요 준수 사항',
        icon: '🚨',
        system: '법령 참조',
        systemUrl: '',
        description: '연구비 사용 시 반드시 알아야 할 준수 사항, 변경 승인 절차, 불인정 사유를 학습합니다.',
        refPage: '혁신법 시행령 제29조~제34조',
        details: [
            '📌 사전 승인이 필요한 변경 사항:',
            '  • 연구개발비 총액 변경',
            '  • 연도별 정부지원금 또는 기관부담금 변경',
            '  • 간접비 총액 증액',
            '',
            '📌 연구활동비 주의사항:',
            '  • 외부전문기술활용비: 직접비의 40% 초과 시 사전 승인 필요',
            '  • 회의비 식비: 외부 인원 참석 회의만 허용, 사전 결재 필수',
            '',
            '📌 연구수당 규정:',
            '  • 수정 인건비의 20% 이내 계상',
            '  • 참여연구자 2인 이상 시, 1인에게 70% 초과 지급 불가',
            '',
            '📌 불인정 처분 주요 사유:',
            '  ❌ 직접비를 간접비로 (또는 반대로) 집행',
            '  ❌ 연구목적 외 사용',
            '  ❌ 허위증빙 또는 이중청구',
            '',
            '📌 정산: 과제/단계 종료 시 정산 (연간 정산 의무 완화)'
        ],
        requiredDocs: [],
        relatedDocs: [],
        quiz: {
            question: '회의비 식비가 인정되려면 어떤 조건이 필요한가요?',
            options: ['내부 직원만 참석해도 가능', '외부 인원 참석 + 사전 결재', '회의록만 있으면 가능', '금액 제한 없이 자유 집행'],
            answer: 1
        }
    },

    // ========================================
    // 그룹 R2: 연구비 관리 규정 실무 적용
    // ========================================
    {
        id: 'mgmt_expense_category',
        order: -1.5,
        group: 'management',
        groupTitle: 'R2. 연구비 관리 규정 실무 적용',
        title: '비목별 집행 기준과 증빙 요건',
        icon: '📋',
        system: '연구비 종합관리시스템 / 베스트케어',
        systemUrl: '',
        description: '각 비목(연구재료비, 연구활동비, 연구시설장비비 등)별 집행 기준, 필수 증빙, 주의사항을 학습합니다.',
        refPage: '혁신법 시행령 별표 / 사업단 내부 규정',
        details: [
            '📌 비목별 집행 기준 요약:',
            '',
            '▶ 연구재료비:',
            '  • 연구 수행에 직접 필요한 재료·시약·소모품',
            '  • 필수 증빙: 견적서(2개+), 세금계산서, 거래명세서, 검수사진',
            '',
            '▶ 연구활동비:',
            '  • 사무용품비, 회의비, 출장여비, 인쇄비, 공공요금 등',
            '  • 회의비: 사전신청서 + 참석자 명단 + 회의록 필수',
            '  • 출장: 출장신청서 + 출장보고서 + 교통비 영수증',
            '',
            '▶ 연구시설·장비비:',
            '  • 고가 장비(1억+): 전문가 자문, 상세 사양 비교 필요',
            '  • 필수 증빙: 견적서, 계약서, 검수보고서, 설치확인서',
            '',
            '▶ 연구개발서비스활용비:',
            '  • 용역계약서 + 계약이행보증각서 + 용역 보고서',
            '',
            '⚠️ 모든 비목: 연구 목적 부합성을 증빙해야 합니다'
        ],
        requiredDocs: [],
        relatedDocs: [],
        quiz: {
            question: '연구활동비(회의비) 집행 시 필수 증빙이 아닌 것은?',
            options: ['사전신청서', '참석자 명단', '회의록', '비교견적서'],
            answer: 3
        }
    },
    {
        id: 'mgmt_change_process',
        order: -1.4,
        group: 'management',
        title: '연구비 변경·이월·정산 절차',
        icon: '🔄',
        system: '연구비 종합관리시스템',
        systemUrl: '',
        description: '연구비 비목 간 전용, 연차 이월, 정산 등 변경 관련 절차와 승인 요건을 학습합니다.',
        refPage: '혁신법 제15조, 시행령 제31조~34조',
        details: [
            '📌 비목 간 전용 (직접비 내):',
            '  • 직접비 세목 간 자유 전용 가능 (사전 승인 불요)',
            '  • 단, 인건비 → 다른 비목 전용 시 기관장 승인 필요',
            '',
            '📌 연차 이월:',
            '  • 해당 연도 미집행 연구비는 다음 연도로 이월 가능',
            '  • 이월 사유서를 작성하여 전문기관에 보고',
            '',
            '📌 정산:',
            '  • 과제(단계) 종료 시 정산 (매년 정산 의무 완화)',
            '  • 정산 결과 잔액은 국고 반납 또는 후속 과제에 활용',
            '  • 정부지원금 이자: 연구 용도 사용 또는 국고 반납',
            '',
            '📌 총액 변경 시 사전 승인 필요:',
            '  ⚠️ 연구개발비 총액 변경',
            '  ⚠️ 간접비 총액 증액',
            '  ⚠️ 연도별 정부지원금/기관부담금 변경'
        ],
        requiredDocs: [],
        relatedDocs: [],
        quiz: {
            question: '직접비 세목 간 전용(예: 재료비→활동비)에 대한 설명으로 맞는 것은?',
            options: ['전용 불가 (비목 고정)', '중앙행정기관 사전 승인 필요', '자유 전용 가능 (사전 승인 불요)', '50% 이내만 전용 가능'],
            answer: 2
        }
    },
    {
        id: 'mgmt_audit_penalty',
        order: -1.3,
        group: 'management',
        title: '감사 대비 및 불인정·환수 사례',
        icon: '🔍',
        system: '법령 참조 / 내부 감사',
        systemUrl: '',
        description: '연구비 감사 시 빈출 지적 사항과 불인정·환수 사례를 학습하여 사전 예방합니다.',
        refPage: '혁신법 제32조~36조',
        details: [
            '📌 주요 불인정 유형:',
            '  ❌ 비목 교차 집행: 직접비↔간접비 교차 사용',
            '  ❌ 목적 외 사용: 연구와 무관한 물품 구매',
            '  ❌ 허위 증빙: 가공 세금계산서, 허위 출장보고서',
            '  ❌ 이중 청구: 동일 건을 복수 과제에 중복 청구',
            '  ❌ 사전 승인 미이행: 변경 승인 없이 총액 초과 집행',
            '',
            '📌 환수 절차:',
            '  • 감사 지적 → 소명 기회 부여 → 불인정 확정 → 환수 통보',
            '  • 환수액 = 불인정 금액 + 이자 (가산금 부과 가능)',
            '',
            '📌 예방 체크리스트:',
            '  ✅ 모든 지출에 목적 부합성 증빙 확보',
            '  ✅ 비목 분류를 정확하게 (재료비/활동비 구분)',
            '  ✅ 증빙일자와 지출일자 일치 확인',
            '  ✅ 카드 사용 건은 건별로 비목·세세목 분류',
            '  ✅ 변경 사항 발생 시 사전 승인 절차 준수',
            '',
            '⚠️ \"몰랐다\"는 소명 사유가 되지 않습니다!'
        ],
        requiredDocs: [],
        relatedDocs: [],
        quiz: {
            question: '다음 중 연구비 불인정 사유에 해당하지 않는 것은?',
            options: ['직접비를 간접비로 집행', '비교견적서 미첨부 (연구재료비)', '직접비 내 세목 간 전용', '허위 출장보고서 제출'],
            answer: 2
        }
    },

    // ========================================
    // 그룹 A: 수입 업무 처리
    // 흐름: e-Branch 입금확인 → 연구비종합관리 수입결의 → 베스트케어 수입결의서
    // ========================================
    {
        id: 'revenue_ebranch',
        order: 0,
        group: 'revenue',
        groupTitle: 'A. 수입 업무 처리',
        title: 'e-Branch – 입금 내역 확인',
        icon: '🏛️',
        system: 'e-Branch (기업은행)',
        refPage: '인수인계서 14p',
        description: '사업비 또는 병원대응자금이 입금되면 e-Branch에서 입금 내역을 확인합니다.',
        details: [
            '🖥️ 바탕화면 e-Branch 실행 → 로그인(ID/PW 입력)',
            '상단 메뉴: [자금관리] → [일반계좌거래내역관리] → [거래내역조회]',
            '사업장: 이화의대부속목동병원 선택',
            '조회기간 설정 (입금 예상일 포함)',
            '은행: 기업은행 / 계좌: 55402028004050 선택',
            '입출구분: 입금',
            '[조회] 버튼 클릭 후 입금 내역 확인',
            '',
            '⚠️ 입금자명, 금액, 사업명/과제명이 인계인수서에 정리된 협약 내용과 일치하는지 반드시 확인'
        ],
        requiredDocs: ['입출금명세서 (e-Branch 출력)'],
        relatedDocs: ['bank_statement'],
        quiz: {
            question: '사업비 입금 확인 시 e-Branch에서 조회하는 메뉴 경로는?',
            options: ['결의관리 → 수입결의', '자금관리 → 일반계좌거래내역관리 → 거래내역조회', '수입관리 → 수입결의', '부서행정 → 결의관리'],
            answer: 1
        }
    },
    {
        id: 'revenue_register',
        order: 0.1,
        group: 'revenue',
        title: '연구비종합관리 – 수입결의 등록',
        icon: '📋',
        system: '연구비 종합관리시스템',
        refPage: '인수인계서 15p',
        description: '연구비종합관리시스템에서 수입결의를 등록하고 전자결재를 진행합니다.',
        details: [
            '🖥️ 연구비관리자 계정(직번)으로 로그인',
            '메뉴: 연구비관리 → [수입관리] → [수입결의(계좌거래)]',
            '[작성] → [추가] 버튼으로 신규 수입결의 생성',
            '사업(과제)번호, 계정과목, 재원(국고/병원 등) 선택',
            'e-Branch에서 확인한 입금 금액 입력',
            '적요에 입금 목적·재단명·협약번호 등 기재',
            '[신청] → 전자결재 → 결재자(담당자) 선택 후 상신',
            '',
            '☑️ 과제번호·사업명 일치 여부',
            '☑️ 재원(국고 / 병원대응자금 등) 선택 오류 여부',
            '☑️ 금액(부가세 포함/제외) 기준 일치'
        ],
        requiredDocs: ['연구비종합관리 수입결의서 (출력)'],
        relatedDocs: ['resolution'],
        quiz: {
            question: '수입결의 등록 시 메뉴 경로는?',
            options: ['지출관리 → 일반청구', '수입관리 → 수입결의(계좌거래)', '결의관리 → 수입결의', '연계관리 → 전송'],
            answer: 1
        }
    },
    {
        id: 'revenue_bestcare',
        order: 0.2,
        group: 'revenue',
        title: '베스트케어 – 수입결의서 작성',
        icon: '🏥',
        system: '베스트케어 시스템',
        refPage: '인수인계서 16p',
        description: '베스트케어에서 수입결의서를 작성합니다. 3종 증빙(연구비종합관리 결의서 + 베스트케어 결의서 + e-Branch 입출금명세서)을 묶어 수기결재 후 재무팀에 제출합니다.',
        details: [
            '🖥️ 로그인 → [부서행정] → [메뉴] → [결의관리]',
            '[수입금미확인내역]에서 해당 입금건 선택',
            '확인일자를 실제 입금일자와 동일하게 입력',
            '[수입결의서등록] 버튼 클릭',
            '계정코드: 64031 / 품명: 과제명 또는 사업명으로 명확히 기입',
            '저장 후 [수입결의서 조회] → 해당 건 검색 → [미리보기] → 인쇄',
            '수기결재 후 재무팀 제출',
            '',
            '📝 3종 증빙을 셋트로 묶어 결재:',
            '  ① 연구비 종합관리시스템 수입결의서',
            '  ② 베스트케어 수입결의서',
            '  ③ e-Branch 입출금명세서',
            '',
            '⚠️ 수기 결재 (전산 결재 아님!)'
        ],
        requiredDocs: ['연구비종합관리 결의서', '베스트케어 결의서', '입출금명세서 (e-Branch)'],
        relatedDocs: ['resolution', 'bank_statement'],
        quiz: {
            question: '베스트케어 수입결의서 등록 시 사용하는 계정코드는?',
            options: ['73731', '73732', '64031', '11113'],
            answer: 2
        }
    },
    {
        id: 'revenue_hospital',
        order: 0.3,
        group: 'revenue',
        title: '병원대응자금 수입결의',
        icon: '🏥',
        system: 'e-Branch → 연구비종합관리 → 베스트케어',
        refPage: '인수인계서 14~16p',
        description: '병원대응자금 입금 시 사업비와 동일한 흐름으로 처리하되, 재원을 병원대응자금으로 구분합니다.',
        details: [
            '사업비 수입결의와 동일 흐름:',
            '① e-Branch에서 입금 확인',
            '② 연구비종합관리시스템에서 수입결의 등록 (재원: 병원대응자금)',
            '③ 베스트케어에서 수입결의서 작성 (계정코드 64031 유지)',
            '',
            '☑️ 재원: 국고 vs 병원대응자금 선택 오류 주의',
            '☑️ 입금 계좌·과제 매칭 확인',
            '☑️ 베스트케어 수입결의서 등록 시 계정코드 64031 유지',
            '',
            '⚠️ 사업비와 병원대응자금을 같은 계좌로 받는 경우,',
            '입금 건별로 재원 구분을 정확히 해야 정산·보고 시 혼선이 없습니다'
        ],
        requiredDocs: ['입출금명세서', '연구비종합관리 결의서', '베스트케어 결의서'],
        relatedDocs: ['resolution', 'bank_statement'],
        quiz: {
            question: '병원대응자금 수입결의 시 가장 주의해야 할 사항은?',
            options: ['계정코드 변경', '재원(국고 vs 병원대응자금) 정확한 구분', '결재라인 변경', '별도 계좌 개설'],
            answer: 1
        }
    },

    // ========================================
    // 그룹 B: 지출 업무 처리 (업무 문서 기반)
    // 전체 흐름: 예산확인 → 사전준비 → 연구비종합관리 청구서 → 전자결재 → 통합이지바로 전송 → e-Branch 이체 → 베스트케어 지출결의서 → 서류철 보관
    // ========================================
    {
        id: 'budget_check',
        order: 1,
        group: 'expense',
        groupTitle: 'B. 지출 업무 처리',
        title: '예산 확인 및 사전 검토',
        icon: '💰',
        system: '지출내역 엑셀 (로컬)',
        description: '지출내역 엑셀에서 예산 항목별 잔여액을 확인하고 집행 가능 여부를 검토합니다.',
        details: [
            '🖥️ 지출내역 엑셀 파일 열기 (2025년 ER바이오코어사업단 지출내역.xls)',
            '재원 구분 확인: 국고 / 병원 대응',
            '지출비목 확인: 내부인건비, 연구활동비, 연구재료비, 연구시설장비비 등',
            '세세목까지 확인하여 정확한 예산 항목에 집행',
            '이미 집행된 금액과 잔여 예산을 비교합니다',
            '⚠️ 과제기간·예산 비목 내 잔액 여부를 반드시 확인'
        ],
        requiredDocs: ['지출내역 엑셀'],
        relatedDocs: ['expense_ledger'],
        quiz: {
            question: '경비 집행 전 가장 먼저 확인해야 할 사항은?',
            options: ['견적서 수집', '세금계산서 발행 요청', '예산 잔여액 및 비목 확인', '청구서 작성'],
            answer: 2
        }
    },
    {
        id: 'preparation',
        order: 2,
        group: 'expense',
        title: '사전 준비 (품의 / 계약 / 증빙 수집)',
        icon: '📋',
        system: '그룹웨어 / 홈택스 / 오프라인',
        description: '내부 품의, 업체 계약, 세금계산서·증빙서류 수집 등 청구서 작성 전 사전 준비를 진행합니다.',
        details: [
            '📌 내부 품의 (사전 승인)',
            '  • 그룹웨어/HWP에서 품의서 작성 (재원, 지출비목, 세세목 명시)',
            '  • 견적서 2개 이상 첨부하여 결재선 승인 요청',
            '',
            '📌 집행 / 계약 체결',
            '  • 용역계약서 또는 구매계약서 체결',
            '  • 용역: 계약이행 보증각서 수령',
            '  • 업체: 사업자등록증, 통장사본 수령',
            '  • 카드 결제: 법인카드 사용 내역 정리',
            '',
            '📌 증빙서류 수집',
            '  • 🖥️ 국세청 홈택스 → 전자세금계산서 확인/출력 (XML/PDF)',
            '  • 거래명세서 수령',
            '  • 물품: 검수사진 + 검수보고서(HWP)',
            '  • 카드: 카드매출전표 보관'
        ],
        requiredDocs: ['내부품의서', '견적서 (2개+)', '세금계산서 (XML/PDF)', '거래명세서', '사업자등록증', '통장사본'],
        relatedDocs: ['internal_approval', 'quotation', 'tax_invoice'],
        quiz: {
            question: '내부 품의 시 견적서는 최소 몇 개 업체에서 받아야 하나요?',
            options: ['1개', '2개', '3개', '4개'],
            answer: 1
        }
    },
    {
        id: 'claim_creation',
        order: 3,
        group: 'expense',
        title: '연구비종합관리시스템 – 청구서 작성',
        icon: '📄',
        system: '연구비 종합관리시스템',
        refPage: '인수인계서 17~19p',
        description: '연구비종합관리시스템에서 청구서를 작성합니다. 일반청구(세금계산서·계좌이체)와 카드청구로 구분됩니다.',
        details: [
            '📌 [일반청구] 세금계산서·계좌이체',
            '🖥️ 메뉴: 연구비관리 → 지출관리 → 일반청구',
            '  ① 전자세금계산서 XML 불러오기 (비밀번호: 사업자등록번호 1178201074)',
            '  ② 공급가·부가세 자동 반영 여부 확인 후 비목·과목 선택',
            '  ③ 계좌이체 건: 거래처자금명·계좌 정보 입력',
            '  ④ 분개수정(세금계산서/계좌이체) 후 [신청] → 전자결재 상신',
            '',
            '📌 [카드청구]',
            '🖥️ 메뉴: 연구비관리 → 지출관리 → 카드청구',
            '  ① 카드 매출내역(카드대금 청구서) 준비, 결제일자 = 당월 출금일(23일) 기준 확인',
            '  ② 미청구 카드내역 선택, 사용 건별로 비목·과제 지정',
            '  ③ 발급자(전상표·이후정·유경하)별 카드번호 구분하여 입력',
            '  ④ [신청] → 전자결재 상신',
            '',
            '⚠️ 세금계산서 열람 비밀번호는 사업자등록번호입니다',
            '⚠️ XML 불러오기 후 공급가·세액 자동 반영 여부 반드시 확인',
            '⚠️ 카드: 결제일자(23일)와 청구 대상 기간 일치 여부 확인',
            '⚠️ 카드 사용일·결제일·청구 대상 기간 불일치 시 정산 불인정 가능'
        ],
        requiredDocs: ['전자세금계산서 XML', '카드매출내역/청구서', '거래명세서'],
        relatedDocs: ['resolution'],
        docTypes: {
            '일반청구 (세금계산서·계좌이체)': {
                description: '세금계산서 또는 계좌이체로 납부한 비용 청구',
                examples: ['연구재료비', '장비 구매비', '기술사업화 컨설팅비', '용역비']
            },
            '카드청구': {
                description: '법인카드 결제 건을 결제일(23일) 기준으로 청구',
                examples: ['사무용품비', '회의비', '교육훈련비', '출장비']
            }
        },
        quiz: {
            question: '일반청구 시 세금계산서 XML 불러오기에 사용하는 비밀번호는?',
            options: ['개인 비밀번호', '사업자등록번호', '공인인증서 비밀번호', '관리자 비밀번호'],
            answer: 1
        }
    },
    {
        id: 'relay_transfer',
        order: 4,
        group: 'expense',
        title: '연계관리 – 통합이지바로 전송',
        icon: '🔗',
        system: '연구비 종합관리시스템',
        description: '전자결재 완료 후 연계관리에서 통합이지바로에 전송합니다. 카드청구도 동일한 흐름입니다.',
        details: [
            '🖥️ 메뉴: 연계관리 (또는 결의정보전송) → 통합이지바로',
            '  ① 결재 완료된 청구(결의)서를 통합이지바로 전송 대상으로 선택',
            '  ② 전송 실행',
            '  ③ 송신 여부·확정 정보 확인',
            '',
            '⚠️ 전자결재가 완료되어야 전송 가능합니다'
        ],
        requiredDocs: ['전자결재 완료된 청구서'],
        relatedDocs: [],
        quiz: {
            question: '통합이지바로 전송이 가능한 시점은?',
            options: ['청구서 작성 직후', '전자결재 완료 후', 'e-Branch 이체 후', '베스트케어 결의서 작성 후'],
            answer: 1
        }
    },
    {
        id: 'ebranch_transfer',
        order: 5,
        group: 'expense',
        title: 'e-Branch 이체 접속 및 실제 이체',
        icon: '🏦',
        system: 'e-Branch (기업은행)',
        description: '통합이지바로에서 전송된 이체 대상을 e-Branch에서 확인하고 실제 이체를 실행합니다.',
        details: [
            '🖥️ e-Branch 접속: 지급대상 전송 연계 확인',
            '  ① 연구비종합관리·통합이지바로에서 이체 대상 전송 완료 확인',
            '  ② e-Branch에서 수신 확인',
            '  ③ 이체 처리 실행 (기업은행 55402028004050 → 업체 계좌)',
            '  ④ 입출금명세서 출력 → 보관',
            '',
            '💡 카드 대금의 경우 카드사 결제일(23일)에 자동 출금'
        ],
        requiredDocs: ['입출금명세서'],
        relatedDocs: ['bank_statement'],
        quiz: {
            question: 'e-Branch 이체 전 반드시 확인해야 할 사항은?',
            options: ['카드 매출전표 수신', '통합이지바로 전송 완료 여부', '베스트케어 결의번호', '엑셀 기록 완료'],
            answer: 1
        }
    },
    {
        id: 'bestcare_resolution',
        order: 6,
        group: 'expense',
        title: '베스트케어 – 지출결의서 작성',
        icon: '📝',
        system: '베스트케어 시스템',
        refPage: '인수인계서 20~21p',
        description: 'e-Branch 이체 완료 후 베스트케어 시스템에서 지출결의서를 작성합니다. 인쇄 후 수기결재하여 재무팀에 제출합니다.',
        details: [
            '🖥️ 메뉴: 부서행정 → 결의관리 → 지출결의 (또는 해당 메뉴)',
            '  ① 비목코드 설정 (73733 장비/연구일비, 73732 재료비 등)',
            '  ② 차변·대변 계정 및 거래처 입력, 전표 생성',
            '  ③ 미리보기 → 인쇄 후 수기결재',
            '  ④ 증빙과 함께 재무팀 제출',
            '',
            '☑️ XML·매입세금계산서 금액과 시스템 입력 금액 일치 확인',
            '☑️ 과제기간·예산 비목 내 잔액 여부 확인',
            '',
            '📌 카드청구의 경우:',
            '  • 카드 매출내역·청구서 증빙 첨부하여 재무팀 제출',
            '  • 비목코드·차변·대변 설정 동일',
            '',
            '⚠️ 이체 완료 후 베스트케어 결의서를 작성하는 순서입니다',
            '',
            '📋 베스트케어 비목코드 요약:',
            '  • 연구활동비: 73731',
            '  • 재료비: 73732',
            '  • 장비비: 73733',
            '  • 연구비: 73734',
            '  • 기타운영비: 21553',
            '  • 가계지급인건비: 21554'
        ],
        requiredDocs: ['베스트케어 지출결의서 (인쇄본)', '증빙서류 일체'],
        relatedDocs: ['resolution'],
        quiz: {
            question: '베스트케어 지출결의서 작성은 어느 시점에 수행하나요?',
            options: ['청구서 작성 직후', '전자결재 완료 직후', 'e-Branch 이체 완료 후', '예산 확인 직후'],
            answer: 2
        }
    },
    {
        id: 'filing',
        order: 7,
        group: 'expense',
        title: '엑셀 기록 및 서류철 보관',
        icon: '🗂️',
        system: '지출내역 엑셀 / Github',
        description: '지출내역 엑셀에 최종 기록하고, 증빙서류를 체계적으로 보관합니다.',
        details: [
            '🖥️ 지출내역 엑셀 파일 열기',
            '23개 컬럼을 모두 입력',
            '진행구분을 "승인"으로 업데이트',
            '이체일자, 문서번호, 결의번호를 엑셀에 기록',
            '',
            '📌 서류철 보관:',
            '  • 청구(결의)서 원본을 스캔하여 PDF로 보관',
            '  • 증빙 묶음을 건별로 정리: 청구서 + 세금계산서 + 거래명세서 + 증빙',
            '  • 연차보고서 작성 시 참조할 수 있도록 비목별 분류',
            '  • 🖥️ Github 사업단 예산 관리 저장소에 백업'
        ],
        requiredDocs: ['지출내역 엑셀 (업데이트)', '스캔된 청구서 PDF', '증빙 묶음 ZIP'],
        relatedDocs: ['expense_ledger'],
        quiz: {
            question: '증빙서류 보관 시 올바른 분류 방법은?',
            options: ['날짜별 일괄 보관', '건별로 청구서+증빙 묶어 보관', '업체별 보관', '금액별 보관'],
            answer: 1
        }
    },

    // ========================================
    // 그룹 C: 대체결의 처리
    // 흐름: 연구비종합관리시스템 → 베스트케어 (수입/대체결의서)
    // ========================================
    {
        id: 'substitute_overview',
        order: 8,
        group: 'substitute',
        groupTitle: 'C. 대체결의 처리',
        title: '대체결의 개요',
        icon: '🔄',
        system: '연구비 종합관리시스템 → 베스트케어',
        refPage: '인수인계서 22~24p',
        description: '간접비·인건비·퇴직적립금·퇴직금·이자수입·이월금 등 재원 간 이동·정산을 위한 결의 절차를 학습합니다.',
        details: [
            '📌 대표 유형 (6가지):',
            '  1) 간접비 대체결의',
            '  2) 인건비 대체결의',
            '  3) 퇴직적립금 대체결의',
            '  4) 퇴직금 대체결의',
            '  5) 이자수입 대체결의',
            '  6) 이월금·국고재원 대체결의',
            '',
            '📌 공통 흐름 요약:',
            '  ① (연구비종합관리시스템) 연구비신청서 또는 일반대체 청구서 작성',
            '  ② 전자결재 상신 및 결재 완료',
            '  ③ (베스트케어) 수입/대체결의서 작성',
            '  ④ 대변·차변 계정 및 계좌 설정',
            '  ⑤ 미리보기 → 인쇄 → 수기결재 → 재무팀 제출',
            '  ⑥ 연구비종합 결의서 + 베스트케어 결의서 = 증빙 묶어 보관'
        ],
        requiredDocs: ['연구비종합관리 결의서', '베스트케어 대체결의서'],
        relatedDocs: ['resolution'],
        quiz: {
            question: '대체결의의 대표 유형이 아닌 것은?',
            options: ['간접비 대체결의', '인건비 대체결의', '지출결의', '이자수입 대체결의'],
            answer: 2
        }
    },
    {
        id: 'substitute_indirect',
        order: 8.1,
        group: 'substitute',
        title: '간접비 대체결의 (예시)',
        icon: '💸',
        system: '연구비 종합관리시스템 → 베스트케어',
        refPage: '인수인계서 22p',
        description: '간접비 징수를 위한 대체결의 절차입니다. 연구비종합관리에서 징수결의서를 작성한 후 베스트케어에서 대체결의서를 등록합니다.',
        details: [
            '📌 연구비종합관리시스템 – 징수결의서',
            '  ① 청구(결의) 유형에서 [징수결의] 선택',
            '  ② 간접비 징수 대상 금액 입력',
            '  ③ 적요에 징수 기준 및 기간 기재',
            '  ④ [신청] 후 전자결재 → 징수결의서 출력',
            '',
            '📌 베스트케어 – 대체결의서',
            '  ① [수입/대체결의관리] → [대체] 선택',
            '  ② [초기화] → [+행추가] 후 내역 입력',
            '  ③ 저장 → [미리보기] → 인쇄',
            '  ④ 수기결재 후 재무팀 제출',
            '',
            '⚠️ 연구비종합 징수결의서와 베스트케어 대체결의서를 한 묶음으로 관리해야',
            '추후 정산·감사 시 추적이 용이합니다'
        ],
        requiredDocs: ['연구비종합관리 징수결의서', '베스트케어 대체결의서'],
        relatedDocs: ['resolution'],
        quiz: {
            question: '간접비 대체결의 시 연구비종합관리에서 선택하는 결의 유형은?',
            options: ['일반청구', '카드청구', '징수결의', '수입결의'],
            answer: 2
        }
    },
    {
        id: 'substitute_labor',
        order: 8.2,
        group: 'substitute',
        title: '인건비 대체결의 (예시)',
        icon: '👤',
        system: '연구비 종합관리시스템 → 베스트케어',
        refPage: '인수인계서 23p',
        description: '인건비는 일반적으로 1월에 일괄 결의하는 경우가 많습니다. 대변(11113 보통예금) → 차변(11114 당좌예금) 이동으로 처리합니다.',
        details: [
            '📌 연구비종합관리시스템',
            '  ① [연구비관리] 또는 청구(결의) 메뉴에서 인건비 관련 청구서/연구비신청서 선택',
            '  ② 급여4대보험 등 인건비 집행 내역에 맞춰 금액·비목 입력',
            '  ③ 적요에 기간·인원자금 기준 기재',
            '  ④ [신청] 후 전자결재 → 결의서 출력',
            '',
            '📌 베스트케어 – 대체결의서',
            '  ① [수입/대체결의관리] → [대체] 선택',
            '  ② 대변: 보통예금(11113), 차변: 당좌예금(11114) 등 계정 설정',
            '  ③ 인건비 비목코드(73731) 확인 후 저장 → [미리보기] → 인쇄',
            '  ④ 수기결재 후 재무팀 제출 (급여지급내역·소득원천징수부 등 증빙 첨부)',
            '',
            '☑️ 11113(보통예금) ↔ 11114(당좌예금) 계정 구분',
            '☑️ 증빙 금액과 시스템 입력 금액 일치'
        ],
        requiredDocs: ['연구비종합관리 결의서', '베스트케어 대체결의서', '급여지급내역', '소득원천징수부'],
        relatedDocs: ['resolution'],
        quiz: {
            question: '인건비 대체결의 시 차변·대변 계정의 올바른 조합은?',
            options: ['대변 11114 → 차변 11113', '대변 11113 → 차변 11114', '대변 64031 → 차변 73731', '대변 73732 → 차변 73733'],
            answer: 1
        }
    }
];

// 체크리스트 및 자주 하는 실수
const CHECKLISTS = {
    common: [
        '과제 기간 내 집행인지 확인 (시작일/종료일 대비)',
        '예산 비목과 실제 지출 비목 일치 여부 (변경 필요 시 협약변경 선행)',
        '세금계산서·영수증·계약서 등 증빙 금액과 시스템 입력 금액 일치',
        '카드 사용일과 결제일, 청구 대상 기간 일치',
        '내부 결재선(관리자·실장·부원장 등) 정확히 지정',
        '수기결재 후 재무팀 제출 여부 확인'
    ],
    byType: {
        revenue: {
            title: '수입결의 결재 전',
            items: [
                '입금액과 수입결의 금액 일치',
                '재원(국고/병원대응자금) 선택 확인',
                '계정코드 64031 등 확인',
                '연구비종합 결의서 + 베스트케어 결의서 셋트'
            ]
        },
        substitute: {
            title: '대체결의 결재 전',
            items: [
                '징수/대체 금액과 증빙 일치',
                '대변·차변 계정(11113, 11114 등) 확인',
                '연구비종합 결의서 + 베스트케어 결의서 묶음 관리'
            ]
        },
        expense: {
            title: '지출결의 결재 전',
            items: [
                'XML·증빙 금액과 입력 금액 일치',
                '비목코드(73731~73734) 적합 여부',
                '통합이지바로 전송·e-Branch 이체 완료 후 베스트케어'
            ]
        }
    },
    commonMistakes: [
        {
            title: '과제 기간 외 집행',
            description: '과제 종료일 이후 또는 개시일 이전의 영수증을 사용하여 결의하는 경우 정산 시 불인정될 수 있습니다. 기간이 애매한 경우 반드시 선배 연구원이나 연구지원팀에 확인합니다.'
        },
        {
            title: '비목 오집행',
            description: '예산은 연구활동비, 장비비, 재료비, 인건비, 간접비 등으로 구분되어 있습니다. 예산과 다른 비목으로 집행하면 추후 정산·감사시 문제될 수 있으므로, 필요 시 비목 조정 후 집행해야 합니다.'
        },
        {
            title: '증빙 누락',
            description: '전자세금계산서 XML, 카드전표, 계약서, 참석자 명단 등 필수 증빙이 누락되면 정산 시 추가 소명자료를 요구받게 됩니다. 인계인수서의 비목별 증빙 목록을 참고하여 미리 준비합니다.'
        }
    ]
};

// 시뮬레이션 시나리오
const SCENARIOS = [
    {
        id: 'material_purchase',
        title: '연구재료비 구매',
        icon: '🧪',
        difficulty: '초급',
        description: '연구용 소모품(시약, 칩 등)을 견적 비교 후 구매하는 시나리오',
        budget: '2,992,000원',
        category: '직접비 > 연구재료비',
        vendor: '자연과학(주)',
        excelSample: {
            no: '', scheduledDate: '', transferDate: '', description: '연구재료비(소모품)_자연과학', amount: '2992000', actualAmount: '2992000',
            fromBank: '기업은행', fromAccount: '55402028004050', payee: '자연과학(주)', toBank: '', toAccount: '',
            processType: '청구서작성', fundSource: '국고', expenseCategory: '연구재료비', subCategory: '연구재료비',
            evidenceDate: '', supplyAmount: '2720000', vatAmount: '272000', status: '승인', vendor: '자연과학(주)',
            accountingDate: '', docNumber: '', resolutionNumber: ''
        },
        items: [
            { name: '100노즐 sorting chip', qty: 2, unitPrice: 616000 },
            { name: 'SH800S Sample line', qty: 3, unitPrice: 330000 },
            { name: 'Setup beads', qty: 5, unitPrice: 108400 }
        ],
        steps: [
            { step: 1, action: '예산 확인', instruction: '지출내역 엑셀에서 연구재료비 예산 잔여액을 확인하세요.', hint: '"연습 모드 > 2025 지출내역 참조" 탭에서 비목별 합계를 확인할 수 있습니다.' },
            { step: 2, action: '견적서 수집', instruction: '최소 2개 업체의 견적서를 받으세요.', hint: '자연과학, 엘에이에스, 티엔에프 등 업체의 견적을 비교합니다.' },
            { step: 3, action: '내부 품의서 작성', instruction: '재료비 구입 내부 품의서를 작성하세요.', formFields: { title: '재료비 구입의 건', content: '연구재료(소모품) 구입이 필요하여 아래와 같이 품의드립니다.', vendor: '자연과학(주)', amount: 2992000 } },
            { step: 4, action: '증빙 수집', instruction: '세금계산서, 거래명세서, 검수사진을 수집하세요.', checklist: ['전자세금계산서', '거래명세서', '검수사진 (HWP)', '통장사본', '사업자등록증'] },
            { step: 5, action: '지출 청구(결의)서 작성', instruction: '연구비 종합관리시스템에서 지출 청구(결의)서를 작성하고, 베스트케어에서 2차 결의 처리를 진행하세요.', formType: 'expense_resolution' },
            { step: 6, action: '엑셀 기록', instruction: '지출내역 엑셀에 23개 컬럼을 모두 입력합니다.', hint: '실전 모드에서 엑셀 내보내기를 사용해 보세요.' }
        ]
    },
    {
        id: 'consulting_service',
        title: '기술사업화 컨설팅 용역',
        icon: '💼',
        difficulty: '중급',
        description: '특허법인을 통한 기술사업화 컨설팅 용역 계약 및 정산 시나리오',
        budget: '29,700,000원',
        category: '직접비 > 연구개발서비스활용비',
        vendor: '특허법인 린 / 특허법인 선정',
        excelSample: {
            no: '', scheduledDate: '', transferDate: '', description: '기술사업화컨설팅_특허법인린', amount: '10000000', actualAmount: '10000000',
            fromBank: '기업은행', fromAccount: '55402028004050', payee: '특허법인 린', toBank: '', toAccount: '',
            processType: '청구서작성', fundSource: '국고', expenseCategory: '연구개발서비스활용비', subCategory: '연구개발서비스활용비',
            evidenceDate: '', supplyAmount: '9090910', vatAmount: '909090', status: '승인', vendor: '특허법인 린',
            accountingDate: '', docNumber: '', resolutionNumber: ''
        },
        items: [
            { name: '기술사업화 컨설팅 (린-스키아)', qty: 1, unitPrice: 10000000 },
            { name: '기술사업화 컨설팅 (선정-엑솔런스)', qty: 1, unitPrice: 9800000 },
            { name: '기술사업화 컨설팅 (선정-티에스바이오)', qty: 1, unitPrice: 9900000 }
        ],
        steps: [
            { step: 1, action: '예산 확인', instruction: '연구개발서비스활용비 항목의 예산 잔여액을 확인하세요.' },
            { step: 2, action: '용역 계약 체결', instruction: '컨설팅 용역계약서를 체결하고 계약이행 보증각서를 수령하세요.', checklist: ['용역계약서', '계약이행 보증각서', '사업자등록증', '통장사본'] },
            { step: 3, action: '용역 보고서 확인', instruction: '기술사업화 용역 컨설팅 보고서를 확인합니다.' },
            { step: 4, action: '증빙 수집', instruction: '전자세금계산서와 거래명세서를 수집하세요.', checklist: ['전자세금계산서 (업체별)', '거래명세서 (업체별)'] },
            { step: 5, action: '지출 청구(결의)서 작성', instruction: '연구비 종합관리시스템에서 컨설팅비 지출 청구(결의)서를 작성하고, 베스트케어에서 2차 결의 처리를 진행하세요.', formType: 'expense_resolution' },
            { step: 6, action: '결재 및 지급', instruction: '청구(결의)서를 결재받고 업체별로 대금을 이체합니다.' }
        ]
    },
    {
        id: 'card_settlement',
        title: '월별 카드대금 정산',
        icon: '💳',
        difficulty: '초급',
        description: '법인카드 사용 후 월별 카드대금 청구(결의)서 작성 시나리오 (처리유형: 청구서작성 카드)',
        budget: '2,349,153원',
        category: '연구활동비 > 사무용품비, 회의비, 교육훈련비 등',
        vendor: '기업은행 법인카드',
        excelSample: {
            no: '', scheduledDate: '', transferDate: '', description: '12월 카드대금', amount: '2349153', actualAmount: '2349153',
            fromBank: '기업은행', fromAccount: '55402028004050', payee: '기업은행 55402028004050', toBank: '기업은행', toAccount: '55402028004050',
            processType: '청구서작성 카드', fundSource: '국고', expenseCategory: '연구활동비', subCategory: '사무용품비,연구환경유지비',
            evidenceDate: '', supplyAmount: '', vatAmount: '', status: '승인', vendor: '',
            accountingDate: '', docNumber: '', resolutionNumber: ''
        },
        items: [
            { name: '사무용품비', qty: 2, unitPrice: 190320 },
            { name: '회의비 (식대 4건)', qty: 4, unitPrice: 181875 },
            { name: '교육훈련비', qty: 1, unitPrice: 1345048 },
            { name: 'AI 코딩툴 구독료', qty: 1, unitPrice: 30205 },
            { name: '복합기 렌탈', qty: 1, unitPrice: 110000 }
        ],
        steps: [
            { step: 1, action: '카드 사용 내역 확인', instruction: '당월 법인카드 사용 내역을 정리하세요.', hint: '기업은행 포털에서 당월 사용내역을 다운로드합니다. 건별로 지출비목/세세목을 구분합니다.' },
            { step: 2, action: '증빙 수집', instruction: '각 거래건별 영수증 또는 카드매출전표를 수집하세요.', checklist: ['카드매출전표', '영수증', '세금계산서 (해당 시)'] },
            { step: 3, action: '지출 청구(결의)서 작성', instruction: '연구비 종합관리시스템에서 카드대금 지출 청구(결의)서를 작성하고, 베스트케어에서 2차 결의 처리를 진행하세요.', formType: 'expense_resolution' },
            { step: 4, action: '엑셀 기록', instruction: '지출내역 엑셀에 건별로 기록합니다. 처리유형은 "청구서작성 카드"입니다.' }
        ]
    },
    {
        id: 'equipment_purchase',
        title: '연구 장비 구매 (고가)',
        icon: '🔬',
        difficulty: '고급',
        description: '대형 연구장비(Cell Sorter 2.2억) 구매 시나리오. 고가 장비는 별도 심의 필요.',
        budget: '220,000,000원',
        category: '직접비 > 연구시설장비비',
        vendor: '자연과학(주)',
        excelSample: {
            no: '', scheduledDate: '', transferDate: '', description: 'Cell Sorter(SH800S)_자연과학', amount: '220000000', actualAmount: '220000000',
            fromBank: '기업은행', fromAccount: '55402028004050', payee: '자연과학(주)', toBank: '', toAccount: '',
            processType: '청구서작성', fundSource: '국고', expenseCategory: '연구시설장비비', subCategory: '연구시설장비비',
            evidenceDate: '', supplyAmount: '200000000', vatAmount: '20000000', status: '승인', vendor: '자연과학(주)',
            accountingDate: '', docNumber: '', resolutionNumber: ''
        },
        items: [{ name: 'Cell Sorter (SH800S)', qty: 1, unitPrice: 220000000 }],
        steps: [
            { step: 1, action: '예산 확인', instruction: '연구시설장비비 예산을 확인하세요.' },
            { step: 2, action: '사양 검토 및 견적', instruction: '장비 사양을 검토하고 견적을 받으세요.', hint: '고가 장비(1억 이상)의 경우 전문가 자문 및 상세 사양 비교가 필요합니다.' },
            { step: 3, action: '내부 품의', instruction: '장비 구매 품의서를 작성하세요.', formFields: { title: '연구장비(Cell Sorter) 구매의 건', amount: 220000000 } },
            { step: 4, action: '계약 및 납품', instruction: '구매 계약을 체결하고 납품/설치를 진행하세요.', checklist: ['구매계약서', '사업자등록증', '통장사본'] },
            { step: 5, action: '검수', instruction: '장비를 검수하고 검수사진 및 검수보고서를 작성하세요.', checklist: ['검수사진', '검수보고서 (HWP)', '설치확인서'] },
            { step: 6, action: '증빙 수집 및 청구(결의)서', instruction: '세금계산서, 거래명세서를 받고 연구비 종합관리시스템에서 지출 청구(결의)서를 작성하세요. 이후 베스트케어에서 2차 결의 처리합니다.', formType: 'expense_resolution' },
            { step: 7, action: '이체 및 엑셀 기록', instruction: '대금을 이체하고 23개 컬럼 엑셀에 기록합니다.' }
        ]
    },
    {
        id: 'research_activity_expense',
        title: '연구활동비 지출',
        icon: '📑',
        difficulty: '초급',
        description: '연구활동비(사무용품, 연구환경유지비 등) 개별 건 지출 시나리오. 연구비 종합관리시스템에서 청구(결의)서를 작성합니다.',
        budget: '528,000원',
        category: '직접비 > 연구활동비 > 사무용품비, 연구환경유지비',
        vendor: '오피스디포(주)',
        excelSample: {
            no: '', scheduledDate: '', transferDate: '', description: '연구활동비(사무용품)_오피스디포', amount: '528000', actualAmount: '528000',
            fromBank: '기업은행', fromAccount: '55402028004050', payee: '오피스디포(주)', toBank: '', toAccount: '',
            processType: '청구서작성', fundSource: '국고', expenseCategory: '연구활동비', subCategory: '사무용품비',
            evidenceDate: '', supplyAmount: '480000', vatAmount: '48000', status: '승인', vendor: '오피스디포(주)',
            accountingDate: '', docNumber: '', resolutionNumber: ''
        },
        items: [
            { name: 'A4용지 (5Box)', qty: 5, unitPrice: 28600 },
            { name: '토너 카트리지 (HP)', qty: 2, unitPrice: 88000 },
            { name: '화이트보드 마커 세트', qty: 3, unitPrice: 15400 },
            { name: '실험실 소모품(장갑, 파이펫 팁)', qty: 1, unitPrice: 162800 }
        ],
        steps: [
            { step: 1, action: '예산 확인', instruction: '지출내역 엑셀에서 연구활동비 > 사무용품비 예산 잔여액을 확인하세요.', hint: '비목: 연구활동비, 세세목: 사무용품비 또는 연구환경유지비' },
            { step: 2, action: '물품 구매', instruction: '필요 물품을 법인카드 결제 또는 계좌이체로 구매합니다.', hint: '소액(50만원 미만)의 경우 견적 비교 생략 가능하나, 가급적 비교견적을 받는 것이 좋습니다.' },
            { step: 3, action: '증빙 수집', instruction: '영수증, 카드매출전표, 세금계산서 등 증빙을 수집하세요.', checklist: ['카드매출전표 또는 세금계산서', '거래명세서', '사업자등록증 (신규 업체)', '통장사본 (계좌이체 시)'] },
            { step: 4, action: '결의서 작성 (연구비 종합관리시스템)', instruction: '연구비 종합관리시스템에 접속하여 연구활동비 청구(결의)서를 작성합니다.', hint: '🖥️ 연구비 종합관리시스템 > 지출결의 등록 메뉴에서 작성합니다. 지출비목을 "연구활동비"로, 세세목을 정확하게 선택하세요.' },
            { step: 5, action: '전자결재', instruction: '연구비 종합관리시스템에서 전자결재를 진행합니다.', hint: '결재: 담당자 → 실장 승인' },
            { step: 6, action: '엑셀 기록', instruction: '지출내역 엑셀에 23개 컬럼을 모두 입력합니다.', hint: '처리유형: 청구서작성 (카드 사용 시 "청구서작성 카드")' }
        ]
    },
    {
        id: 'meeting_expense',
        title: '회의비 사전신청 및 지출결의',
        icon: '🍽️',
        difficulty: '중급',
        description: '회의비 사전신청서를 작성·승인 후 회의를 진행하고, 참석자 명단·회의록과 함께 지출결의서를 작성하는 시나리오',
        budget: '200,000원',
        category: '직접비 > 연구활동비 > 회의비',
        vendor: '한식당 (법인카드 결제)',
        excelSample: {
            no: '', scheduledDate: '', transferDate: '', description: '연구활동비(회의비)_연구미팅', amount: '200000', actualAmount: '200000',
            fromBank: '기업은행', fromAccount: '55402028004050', payee: '기업은행 55402028004050', toBank: '기업은행', toAccount: '55402028004050',
            processType: '청구서작성 카드', fundSource: '국고', expenseCategory: '연구활동비', subCategory: '회의비',
            evidenceDate: '', supplyAmount: '181818', vatAmount: '18182', status: '승인', vendor: '',
            accountingDate: '', docNumber: '', resolutionNumber: ''
        },
        items: [
            { name: '연구 진행 협의 미팅 식대 (5인)', qty: 1, unitPrice: 200000 }
        ],
        steps: [
            { step: 1, action: '회의비 사전신청서 작성', instruction: '회의 전 사전신청서를 작성합니다. 회의 목적, 일시, 장소, 참석 예정 인원을 기재합니다.', formFields: { title: '연구 진행 협의 회의비 사전신청의 건', content: '연구 과제 진행 상황 점검 및 향후 계획 논의를 위한 회의비 사전 신청', amount: 200000 }, hint: '⚠️ 회의비는 반드시 회의 전에 사전신청서를 제출하고 승인을 받아야 합니다.' },
            { step: 2, action: '사전신청 결재', instruction: '사전신청서를 결재선에 따라 승인 요청합니다.', hint: '결재 완료 후 회의를 진행하세요. 사전 승인 없이 집행하면 불인정될 수 있습니다.' },
            { step: 3, action: '회의 진행 및 법인카드 결제', instruction: '승인된 예산 범위 내에서 회의를 진행하고 법인카드로 결제합니다.', hint: '1인당 회의비 한도를 확인하세요. 초과 금액은 개인 부담입니다.' },
            { step: 4, action: '증빙 수집', instruction: '회의비 관련 증빙서류를 수집합니다.', checklist: ['카드매출전표 (영수증)', '회의 참석자 명단 (서명 포함)', '회의록 (회의 내용 요약)', '사전신청서 (승인 완료본)'] },
            { step: 5, action: '지출 청구(결의)서 작성', instruction: '연구비 종합관리시스템에서 회의비 지출 청구(결의)서를 작성합니다. 사전신청서와 증빙을 모두 첨부합니다. 이후 베스트케어에서 2차 결의 처리합니다.', formType: 'expense_resolution', hint: '지출비목: 연구활동비, 세세목: 회의비. 참석자 명단과 회의록을 반드시 첨부하세요.' },
            { step: 6, action: '엑셀 기록', instruction: '지출내역 엑셀에 기록합니다.', hint: '처리유형: "청구서작성 카드". 세세목에 "회의비"를 정확히 기재합니다.' }
        ]
    },
    {
        id: 'journal_entry_correction',
        title: '분개수정 (베스트케어)',
        icon: '🔧',
        difficulty: '중급',
        description: '이미 처리된 청구(결의)서의 계정과목, 금액, 적요 등을 베스트케어 시스템에서 분개수정하는 시나리오. 오류 발견 시 필수 작업입니다.',
        budget: '-',
        category: '수정 작업 (기존 결의 건)',
        vendor: '-',
        excelSample: {
            no: '', scheduledDate: '', transferDate: '', description: '(분개수정) 연구재료비→연구활동비 비목변경', amount: '528000', actualAmount: '528000',
            fromBank: '기업은행', fromAccount: '55402028004050', payee: '', toBank: '', toAccount: '',
            processType: '분개수정', fundSource: '국고', expenseCategory: '연구활동비', subCategory: '사무용품비',
            evidenceDate: '', supplyAmount: '480000', vatAmount: '48000', status: '승인', vendor: '',
            accountingDate: '', docNumber: '', resolutionNumber: ''
        },
        items: [
            { name: '수정 전: 연구재료비 528,000원', qty: 1, unitPrice: 0 },
            { name: '수정 후: 연구활동비(사무용품비) 528,000원', qty: 1, unitPrice: 528000 }
        ],
        steps: [
            { step: 1, action: '수정 대상 확인', instruction: '분개수정이 필요한 결의 건을 확인합니다. 오류 내용(잘못된 비목, 금액 오류, 적요 오류 등)을 파악하세요.', hint: '지출내역 엑셀 또는 베스트케어 시스템에서 해당 결의번호를 조회합니다.' },
            { step: 2, action: '베스트케어 분개수정 메뉴 접속', instruction: '베스트케어 시스템에 접속하여 분개수정 메뉴로 이동합니다.', hint: '🖥️ 베스트케어 > 결의관리 > 분개수정. 해당 결의번호를 검색하여 수정 대상을 선택합니다.' },
            { step: 3, action: '수정 내용 입력', instruction: '수정할 항목(계정과목, 금액, 적요 등)을 변경합니다.', checklist: ['수정 전 계정과목 확인', '수정 후 계정과목 선택', '금액 수정 (필요 시)', '적요 수정 (필요 시)', '수정 사유 기재'] },
            { step: 4, action: '수정 사유서 작성', instruction: '분개수정 사유서를 작성합니다. 수정 전/후 내용을 명확히 기재합니다.', hint: '수정 사유 예시: "비목 분류 오류로 인한 수정", "금액 입력 오류 정정" 등' },
            { step: 5, action: '전자결재', instruction: '연구비 종합관리시스템에서 전자결재를 진행합니다.', hint: '결재: 담당자 → 실장 승인' },
            { step: 6, action: '엑셀 반영', instruction: '지출내역 엑셀에서 해당 건의 수정 내용을 반영합니다.', hint: '비목, 세세목, 금액 등을 수정하고 비고란에 "분개수정"을 기재합니다.' }
        ]
    },
    {
        id: 'substitute_labor_pension',
        title: '인건비 및 퇴직적립금 대체결의',
        icon: '👤',
        difficulty: '중급',
        description: '매월 또는 매년 정기적으로 발생하는 인건비와 퇴직적립금을 다른 계좌로 이동(대체) 처리하는 시나리오',
        budget: '12,500,000원',
        category: '대체결의 > 인건비 / 퇴직적립금',
        vendor: '자체 계좌이체',
        excelSample: {
            no: '', scheduledDate: '', transferDate: '', description: '인건비 대체 입금_12월분', amount: '12500000', actualAmount: '12500000',
            fromBank: '기업은행', fromAccount: '55402028004050', payee: '55402028004050', toBank: '기업은행', toAccount: '55402030005080',
            processType: '대체결의', fundSource: '국고', expenseCategory: '내부인건비', subCategory: '내부인건비',
            evidenceDate: '', supplyAmount: '12500000', vatAmount: '0', status: '승인', vendor: '',
            accountingDate: '', docNumber: '', resolutionNumber: ''
        },
        items: [
            { name: '12월 참여연구원 인건비', qty: 1, unitPrice: 10000000 },
            { name: '퇴직적립금 (10%)', qty: 1, unitPrice: 2500000 }
        ],
        steps: [
            { step: 1, action: '집행 내역 확인', instruction: '인건비 지급 내역서와 퇴직적립금 산출 내역을 확인하세요.' },
            { step: 2, action: '연구비 종합관리시스템 결의', instruction: '연구비 종합관리시스템에서 [징수결의] 또는 [일반대체] 청구서를 작성합니다.', hint: '인건비는 보통예금(11113)에서 당좌예금(11114)으로 이동합니다.' },
            { step: 3, action: '베스트케어 대체결의서 작성', instruction: '베스트케어에서 수비/대체결의관리 메뉴를 통해 대체결의서를 작성하세요.', formType: 'substitute_resolution' },
            { step: 4, action: '증빙 합본 및 제출', instruction: '연구비종합 결의서와 베스트케어 결의서를 묶어 재무팀에 제출합니다.', checklist: ['급여지급내역', '소득원천징수부', '대체결의서(2종)'] }
        ]
    }
];

// 양식 필드 정의 (엑셀 컬럼 매칭)
const FORM_FIELDS = {
    expense_resolution: {
        title: '지출 청구(결의)서',
        fields: [
            { id: 'resDate', label: '결의일자', type: 'date', required: true },
            { id: 'resNo', label: '결의번호', type: 'text', required: true, placeholder: '예: 지출-2026-001' },
            {
                id: 'accountTitle', label: '지출비목', type: 'select', required: true,
                options: ['연구재료비', '연구개발서비스활용비', '연구시설장비비', '연구활동비', '내부인건비', '간접비']
            },
            { id: 'subCategory', label: '세세목', type: 'text', required: false, placeholder: '예: 사무용품비,연구환경유지비' },
            { id: 'fundSource', label: '재원', type: 'select', required: true, options: ['국고', '병원'] },
            { id: 'description', label: '지출내역', type: 'textarea', required: true, placeholder: '지출 내용을 상세히 기재하세요' },
            { id: 'vendor', label: '거래처(지급처)', type: 'text', required: true, placeholder: '업체명' },
            { id: 'supplyAmount', label: '공급가액 (원)', type: 'number', required: true },
            { id: 'vatAmount', label: '부가세액 (원)', type: 'number', required: false },
            { id: 'amount', label: '지출금액 (합계)', type: 'number', required: true },
            { id: 'processType', label: '처리유형', type: 'select', required: true, options: ['청구서작성', '청구서작성 카드'] },
            { id: 'fromBank', label: '출금은행', type: 'text', required: false, placeholder: '기업은행' },
            { id: 'fromAccount', label: '출금계좌', type: 'text', required: false, placeholder: '55402028004050' },
            { id: 'toBank', label: '입금은행', type: 'text', required: false, placeholder: '' },
            { id: 'toAccount', label: '입금계좌', type: 'text', required: false, placeholder: '' },
            {
                id: 'attached', label: '첨부서류', type: 'checklist',
                items: ['세금계산서', '거래명세서', '견적서', '비교견적서', '계약서', '사업자등록증', '통장사본', '검수사진', '내부품의서', '카드매출전표', '검수보고서(HWP)']
            }
        ]
    },
    income_resolution: {
        title: '수입결의서',
        fields: [
            { id: 'resDate', label: '결의일자', type: 'date', required: true },
            { id: 'resNo', label: '결의번호', type: 'text', required: true, placeholder: '예: 수입-2026-001' },
            { id: 'accountTitle', label: '계정과목', type: 'select', required: true, options: ['연구비 입금', '환불금', '이자수입', '병원대응자금'] },
            { id: 'description', label: '적요', type: 'textarea', required: true },
            { id: 'source', label: '입금처', type: 'text', required: true },
            { id: 'amount', label: '금액 (원)', type: 'number', required: true },
            { id: 'fundSource', label: '재원', type: 'select', required: true, options: ['국고', '병원'] }
        ]
    },
    substitute_resolution: {
        title: '대체결의서',
        fields: [
            { id: 'resDate', label: '결의일자', type: 'date', required: true },
            { id: 'resNo', label: '결의번호', type: 'text', required: true, placeholder: '예: 대체-2026-001' },
            { id: 'accountTitle', label: '계정과목', type: 'select', required: true, options: ['간접비 대체결의', '인건비 대체결의', '퇴직적립금 대체결의', '퇴직금 대체결의', '이자수입 대체결의', '이월금·국고재원 대체결의'] },
            { id: 'description', label: '적요', type: 'textarea', required: true },
            { id: 'debitAccount', label: '차변 계정', type: 'text', required: true },
            { id: 'creditAccount', label: '대변 계정', type: 'text', required: true },
            { id: 'amount', label: '금액 (원)', type: 'number', required: true },
            { id: 'fundSource', label: '재원', type: 'select', required: true, options: ['국고', '병원'] }
        ]
    }
};

// 증빙서류 유형 (클릭 상세 조회용 샘플 파일 매핑 포함)
const DOCUMENT_TYPES = [
    {
        id: 'expense_ledger',
        name: '지출내역 엑셀',
        icon: '📊',
        description: '모든 경비 집행을 기록하는 마스터 엑셀 파일. 23개 컬럼으로 구성.',
        when: '상시 (집행 시마다 기록)',
        format: 'XLS/XLSX',
        columns: EXCEL_COLUMNS.map(c => c.label),
        sampleFiles: [],
        detailHtml: `<h3>📊 지출내역 엑셀 컬럼 구조</h3>
      <table class="preview-table"><thead><tr><th>컬럼명</th><th>설명</th><th>예시</th></tr></thead><tbody>
      <tr><td>NO</td><td>일련번호</td><td>1, 2, 3...</td></tr>
      <tr><td>지출예정일자</td><td>8자리 YYYYMMDD</td><td>20260127</td></tr>
      <tr><td>이체일자</td><td>실제 이체된 날짜</td><td>20260123</td></tr>
      <tr><td>지출내역</td><td>지출 내용</td><td>연구재료비(소모품)_자연과학</td></tr>
      <tr><td>지출금액</td><td>총 지출금액</td><td>2,992,000</td></tr>
      <tr><td>실지출금액</td><td>실제 지출된 금액</td><td>2,992,000</td></tr>
      <tr><td>출금은행명</td><td>사업단 출금은행</td><td>기업은행</td></tr>
      <tr><td>출금계좌</td><td>사업단 계좌번호</td><td>55402028004050</td></tr>
      <tr><td>지급처</td><td>대금 수령처</td><td>자연과학(주)</td></tr>
      <tr><td>입금은행명</td><td>업체 입금은행</td><td>국민은행</td></tr>
      <tr><td>입금계좌</td><td>업체 계좌번호</td><td>03290104072735</td></tr>
      <tr><td>처리유형</td><td>청구서작성/카드</td><td>청구서작성</td></tr>
      <tr><td>재원</td><td>국고/병원</td><td>국고</td></tr>
      <tr><td>지출비목</td><td>예산 과목</td><td>연구재료비</td></tr>
      <tr><td>세세목</td><td>상세 예산 과목</td><td>연구재료비</td></tr>
      <tr><td>증빙일자</td><td>증빙서류 날짜</td><td>20250915</td></tr>
      <tr><td>공급가액</td><td>부가세 전 금액</td><td>2,720,000</td></tr>
      <tr><td>부가세액</td><td>VAT 금액</td><td>272,000</td></tr>
      <tr><td>진행구분</td><td>승인 상태</td><td>승인</td></tr>
      <tr><td>구입처</td><td>실제 구입 업체</td><td>자연과학(주)</td></tr>
      <tr><td>회계전송(예정)일</td><td>회계 시스템 전송일</td><td>20260127</td></tr>
      <tr><td>문서번호</td><td>관리 문서번호</td><td>202200630004-20260127-0004</td></tr>
      <tr><td>결의번호</td><td>결의서 번호</td><td>2022006300040001150001</td></tr>
      </tbody></table>`
    },
    {
        id: 'internal_approval',
        name: '내부품의서',
        icon: '📋',
        description: '사전 승인을 위한 내부 요청 문서. 재원, 비목, 업체, 금액을 명시.',
        when: '경비 집행 전',
        format: 'HWP/PDF',
        sampleFiles: ['1차 집행 (자연과학_2,992,000원, 제이원_2,996,400원)/[내부품의] 재료비 구입의건(제이원, 자연과학).pdf'],
        detailHtml: `<h3>📋 내부품의서 주요 항목</h3>
      <ul><li><b>제목</b>: ○○ 구입(용역)의 건</li><li><b>목적</b>: 구매/용역 필요성</li><li><b>업체명</b>: 거래 업체명</li><li><b>금액</b>: 총 금액(부가세 포함)</li><li><b>재원</b>: 국고/병원</li><li><b>비목</b>: 연구재료비/연구활동비 등</li><li><b>첨부</b>: 견적서, 비교견적서</li></ul>
      <p style="margin-top:12px;color:var(--text-muted);">📎 샘플: <code>[내부품의] 재료비 구입의건(제이원, 자연과학).pdf</code></p>`
    },
    {
        id: 'quotation',
        name: '견적서',
        icon: '📊',
        description: '업체로부터 받는 가격 견적 문서. 최소 2곳 이상 비교 필요.',
        when: '품의 전',
        format: 'PDF',
        sampleFiles: [
            '1차 집행 (자연과학_2,992,000원, 제이원_2,996,400원)/자연과학 재료비/자연과학 최종견적서.pdf',
            '1차 집행 (자연과학_2,992,000원, 제이원_2,996,400원)/제이원 재료비/제이원 최종견적서.pdf'
        ],
        detailHtml: `<h3>📊 견적서 확인 포인트</h3>
      <ul><li>품목, 수량, 단가, 공급가액, 부가세, 합계가 정확한지 확인</li><li>업체명, 대표자, 사업자등록번호가 기재되어 있는지 확인</li><li>유효기간 내의 견적인지 확인</li><li>최소 2개 업체 이상의 비교견적 필요</li></ul>`
    },
    {
        id: 'comparison_quote',
        name: '비교견적서',
        icon: '⚖️',
        description: '2개 이상 업체 견적 비교표. 최저가 업체 선정 근거.',
        when: '품의 시 첨부',
        format: 'PDF/HWP',
        sampleFiles: [
            '1차 집행 (자연과학_2,992,000원, 제이원_2,996,400원)/(붙임1) 재료비 최종견적서 및 비교견적서 1부..pdf'
        ],
        detailHtml: `<h3>⚖️ 비교견적서 작성 요령</h3>
      <ul><li>동일 품목에 대해 최소 2개 업체 견적을 병렬 비교</li><li>낙찰 업체 선정 사유 기재</li><li>품목, 단가, 수량, VAT, 합계를 동일한 기준으로 비교</li></ul>`
    },
    {
        id: 'contract',
        name: '계약서',
        icon: '📝',
        description: '용역 또는 구매 계약 문서. 금액, 기간, 범위를 명시.',
        when: '품의 승인 후',
        format: 'PDF',
        sampleFiles: [
            '1. 기술사업화 컨설팅(린, 선정)/컨설팅 용역계약서(특허법인 린_스키아).pdf',
            '1. 기술사업화 컨설팅(린, 선정)/컨설팅 용역계약서(특허법인 선정_엑솔런스).pdf'
        ],
        detailHtml: `<h3>📝 계약서 체크리스트</h3>
      <ul><li>계약 당사자 (갑/을) 확인</li><li>계약 금액 및 지급 조건</li><li>납품/용역 기간</li><li>계약 범위 및 성과물</li><li>양측 직인/서명</li></ul>`
    },
    {
        id: 'guarantee',
        name: '계약이행 보증각서',
        icon: '🛡️',
        description: '용역 이행을 보증하는 각서. 용역 계약 시 수령.',
        when: '계약 시',
        format: 'HWP/PDF',
        sampleFiles: [
            '1. 기술사업화 컨설팅(린, 선정)/[양식] 용역 계약이행 보증각서(린).hwp',
            '1. 기술사업화 컨설팅(린, 선정)/엑솔런스_계약이행보증각서.pdf'
        ],
        detailHtml: `<h3>🛡️ 보증각서 핵심 내용</h3>
      <ul><li>계약 이행을 보증하는 내용</li><li>보증 기간</li><li>불이행 시 조치 사항</li><li>업체 대표 서명/직인</li></ul>`
    },
    {
        id: 'tax_invoice',
        name: '전자세금계산서',
        icon: '🧾',
        description: '국세청 홈택스 발행 세금계산서. XML/HTML/PDF 형태로 보관.',
        when: '납품/용역 완료 후',
        format: 'PDF/HTML/XML',
        sampleFiles: [
            '1차 집행 (자연과학_2,992,000원, 제이원_2,996,400원)/자연과학 재료비/세금계산서.pdf',
            '1차 집행 (자연과학_2,992,000원, 제이원_2,996,400원)/제이원 재료비/전자세금계산서.pdf'
        ],
        detailHtml: `<h3>🧾 세금계산서 확인 포인트</h3>
      <ul><li><b>공급가액</b>과 <b>부가세액</b>이 정확한지 확인</li><li><b>공급자</b> 사업자번호와 상호 확인</li><li><b>공급받는자</b>가 이화의대부속목동병원인지 확인</li><li>XML 파일도 함께 보관 (홈택스 검증용)</li><li>엑셀 컬럼의 공급가액/부가세액과 일치하는지 확인</li></ul>`
    },
    {
        id: 'transaction_statement',
        name: '거래명세서',
        icon: '📃',
        description: '거래 내역(품목/수량/단가)을 상세히 기재한 문서.',
        when: '납품 시',
        format: 'PDF',
        sampleFiles: [
            '1차 집행 (자연과학_2,992,000원, 제이원_2,996,400원)/자연과학 재료비/거래명세서_20250915_이대목동.pdf',
            '1차 집행 (자연과학_2,992,000원, 제이원_2,996,400원)/제이원 재료비/2025 0910_거래명세서.pdf'
        ],
        detailHtml: `<h3>📃 거래명세서 확인 포인트</h3>
      <ul><li>품목, 수량, 단가, 합계 확인</li><li>공급자와 공급받는자 정보 확인</li><li>견적서와 금액 일치 여부 확인</li></ul>`
    },
    {
        id: 'business_registration',
        name: '사업자등록증',
        icon: '🏢',
        description: '거래 업체의 사업자등록증 사본. 최초 거래 시 수령.',
        when: '최초 거래 시',
        format: 'PDF',
        sampleFiles: [
            '1차 집행 (자연과학_2,992,000원, 제이원_2,996,400원)/자연과학 재료비/사업자등록증_자연과학주식회사_20221212.pdf',
            '1차 집행 (자연과학_2,992,000원, 제이원_2,996,400원)/제이원 재료비/사업자등록증.pdf'
        ],
        detailHtml: `<h3>🏢 사업자등록증 확인 포인트</h3>
      <ul><li>상호, 대표자, 사업자번호 확인</li><li>업태/종목 확인</li><li>세금계산서의 공급자 정보와 일치하는지 확인</li></ul>`
    },
    {
        id: 'bank_account',
        name: '통장사본',
        icon: '🏦',
        description: '대금 이체를 위한 업체 통장사본. 입금은행/입금계좌 확인용.',
        when: '최초 거래 시',
        format: 'PDF',
        sampleFiles: [
            '1차 집행 (자연과학_2,992,000원, 제이원_2,996,400원)/자연과학 재료비/통장사본_자연과학(주).pdf',
            '1차 집행 (자연과학_2,992,000원, 제이원_2,996,400원)/제이원 재료비/통장사본.pdf'
        ],
        detailHtml: `<h3>🏦 통장사본 확인 포인트</h3>
      <ul><li>은행명, 계좌번호, 예금주 확인</li><li>세금계산서 상의 공급자와 예금주 일치 여부</li><li>엑셀 입금은행명/입금계좌 컬럼에 기록</li></ul>`
    },
    {
        id: 'inspection_photo',
        name: '검수사진/검수보고서',
        icon: '📷',
        description: '물품 납품 확인 사진 및 검수보고서(HWP). 물품 구매 시 필수.',
        when: '납품 시',
        format: 'JPG/HWP',
        sampleFiles: [
            '1차 집행 (자연과학_2,992,000원, 제이원_2,996,400원)/자연과학 재료비/재료비 검수사진.hwp'
        ],
        detailHtml: `<h3>📷 검수사진/보고서 작성 요령</h3>
      <ul><li>납품된 물품의 전체 사진, 라벨/모델명 사진 촬영</li><li>HWP 양식에 사진을 삽입하여 검수보고서 완성</li><li>검수일자, 검수자, 물품명, 수량을 기재</li></ul>`
    },
    {
        id: 'resolution',
        name: '결의서 (지출/수입/대체)',
        icon: '📄',
        description: '지출/수입/대체 결의 문서. 스캔하여 PDF로 보관.',
        when: '증빙 수집 완료 후',
        format: 'PDF',
        sampleFiles: [],
        detailHtml: `<h3>📄 결의서 유형 비교</h3>
      <table class="preview-table"><thead><tr><th>유형</th><th>용도</th><th>예시</th></tr></thead><tbody>
      <tr><td>지출결의서</td><td>물품/용역/카드대금 지출</td><td>연구재료비, 컨설팅비, 장비구매, 카드대금</td></tr>
      <tr><td>수입결의서</td><td>입금/환불/이자 수입</td><td>병원대응자금(1.5억), 카드환불, 이자수입</td></tr>
      <tr><td>대체결의서</td><td>계정 간 대체</td><td>상/하반기 인건비, 퇴직충당금</td></tr>
      </tbody></table>`
    },
    {
        id: 'bank_statement',
        name: '입출금명세서',
        icon: '💰',
        description: '은행 입출금 확인 문서. 이체 후 출력 보관.',
        when: '대금 지급 후',
        format: 'PDF',
        sampleFiles: [],
        detailHtml: `<h3>💰 입출금명세서 보관 요령</h3>
      <ul><li>이체 후 즉시 기업은행에서 출력</li><li>결의서와 함께 묶어 보관</li><li>엑셀의 이체일자 컬럼에 실제 이체일 기록</li></ul>`
    },
    {
        id: 'evidence_bundle',
        name: '증빙 묶음',
        icon: '📦',
        description: '한 건의 지출에 대한 모든 증빙을 묶은 폴더/ZIP. 건별로 관리.',
        when: '정산 완료 후',
        format: 'ZIP/폴더',
        sampleFiles: [
            '1차 집행 (자연과학_2,992,000원, 제이원_2,996,400원)/자연과학 재료비/증빙) 자연과학 재료비_2,992,000원.pdf',
            '1차 집행 (자연과학_2,992,000원, 제이원_2,996,400원)/제이원 재료비/증빙) 제이원 재료비_2,996,400원.pdf'
        ],
        detailHtml: `<h3>📦 증빙 묶음 구성 예시 (연구재료비)</h3>
      <ol>
        <li>내부품의서</li>
        <li>비교견적서 + 최종견적서</li>
        <li>세금계산서 (PDF + XML)</li>
        <li>거래명세서</li>
        <li>검수사진 / 검수보고서 (HWP)</li>
        <li>사업자등록증</li>
        <li>통장사본</li>
        <li>증빙 PDF (합본)</li>
      </ol>
      <p style="margin-top:12px;color:var(--text-muted);">파일명 규칙: <code>증빙) [업체명] [비목]_[금액]원.pdf</code></p>`
    }
];

// 업무 전체 개요 설명 데이터
const OVERALL_OVERVIEW = {
    title: '🏥 사업단 경비 처리 업무 전체 개요',
    description: 'ER 바이오코어 사업단의 경비 처리는 국가연구개발혁신법을 준수하며, 크게 수입, 지출, 대체 업무로 나뉩니다.',
    content: `
        <div class="overview-section">
            <h3 class="overview-subtitle">1. 업무 흐름 요약</h3>
            <div class="overview-steps">
                <div class="overview-step">
                    <div class="step-icon">💰</div>
                    <h4>수입 업무</h4>
                    <p>사업비 및 대응자금 입금 확인 후 시스템 등록 및 결의서 작성</p>
                </div>
                <div class="overview-step">
                    <div class="step-icon">💸</div>
                    <h4>지출 업무</h4>
                    <p>예산 확인, 증빙 수집, 시스템 청구, 전자결재, 이체 및 결의서 제출</p>
                </div>
                <div class="overview-step">
                    <div class="step-icon">🔄</div>
                    <h4>대체 업무</h4>
                    <p>인건비, 간접비, 이자 등 재원 간 이동 및 정산 처리</p>
                </div>
            </div>
        </div>
        
        <div class="overview-section">
            <h3 class="overview-subtitle">2. 주요 핵심 도구 (Tool Stack)</h3>
            <ul class="tool-list">
                <li><strong>e-Branch (IBK)</strong>: 실시간 입출금 확인 및 이체 실행</li>
                <li><strong>연구비 종합관리시스템</strong>: 연구비 청구, 수입/징수 결의 및 전자결재</li>
                <li><strong>베스트케어 (병원시스템)</strong>: 공식 지출/수입/대체 결의서 작성 및 재무팀 제출</li>
                <li><strong>통합 이지바로 (Ezbaro)</strong>: 국고 연구비 실시간 통합 관리 및 정산 연계</li>
            </ul>
        </div>

        <div class="overview-section">
            <h3 class="overview-subtitle">3. 준수 사항 (Compliance)</h3>
            <div class="compliance-alert">
                <p>⚠️ <strong>국가연구개발혁신법</strong>에 따라 모든 집행은 연구 목적에 부합해야 하며, 증빙 서류는 5년간 보관 의무가 있습니다.</p>
            </div>
            <div style="margin-top:20px; text-align:center;">
                <a href="https://bio-core-tutorial.vercel.app/" target="_blank" class="btn btn-outline">🔗 상세 업무 매뉴얼 (외부 링크)</a>
            </div>
        </div>
    `
};

export { WORKFLOW_STEPS, SCENARIOS, FORM_FIELDS, DOCUMENT_TYPES, EXCEL_COLUMNS, OVERALL_OVERVIEW };

