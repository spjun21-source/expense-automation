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
    // 그룹 A: 사업비 수입 처리 (인수인계서 14~16p)
    // ========================================
    {
        id: 'revenue_deposit_a',
        order: 0,
        group: 'revenue',
        groupTitle: 'A. 사업비 수입 처리',
        title: '[유형A] 한국연구재단 사업비 입금 확인',
        icon: '🏛️',
        system: 'eBranch (기업은행)',
        systemUrl: 'https://ebranch.ibk.co.kr',
        description: '한국연구재단 사업비가 입금되면 eBranch 시스템에서 이체 금액을 확인하고 입출금명세서를 출력합니다.',
        refPage: '인수인계서 14p',
        details: [
            '🖥️ eBranch (기업은행 인터넷뱅킹) 접속',
            '사업단 계좌(55402028004050)의 입금 내역 확인',
            '한국연구재단 이체 금액 확인',
            '입출금명세서 출력 (증빙용 보관)',
            '⚠️ 입금일자, 금액을 정확히 기록합니다'
        ],
        requiredDocs: ['입출금명세서 (eBranch 출력)'],
        relatedDocs: ['bank_statement'],
        quiz: {
            question: '한국연구재단 사업비 입금 확인은 어느 시스템에서 하나요?',
            options: ['베스트케어', 'eBranch (기업은행)', '연구비 종합관리 시스템', '홈택스'],
            answer: 1
        }
    },
    {
        id: 'revenue_register',
        order: 0.1,
        group: 'revenue',
        title: '[유형A] 수입결의 등록 및 전자결재',
        icon: '📋',
        system: '연구비 종합관리 시스템',
        systemUrl: '',
        description: '연구비 종합관리 시스템에 접속하여 수입결의를 등록하고 전자결재를 진행합니다.',
        refPage: '인수인계서 15p',
        details: [
            '🖥️ 연구비 종합관리 시스템 접속',
            '수입결의 등록 메뉴에서 입금 내역 입력',
            '전자결재: 담당자 처리',
            '입력 사항 확인 후 결의서 증빙 출력',
            '결재: 실장 → 고무인(직인) 날인',
            '⚠️ 전자결재 시스템에서 처리 (수기 결재 아님)'
        ],
        requiredDocs: ['연구비 종합관리 시스템 수입결의서 (출력)'],
        relatedDocs: ['resolution'],
        quiz: {
            question: '수입결의 전자결재 시 결재권자는?',
            options: ['파트장', '부원장', '실장 (고무인)', '융의원장'],
            answer: 2
        }
    },
    {
        id: 'revenue_bestcare',
        order: 0.2,
        group: 'revenue',
        title: '[유형A] 2차 수입결의서 작성 (베스트케어)',
        icon: '🏥',
        system: '베스트케어 시스템',
        systemUrl: '',
        description: '베스트케어 시스템 > 결의관리 메뉴에서 2차 수입결의서를 작성합니다. 3종 증빙을 묶어 수기 결재합니다.',
        refPage: '인수인계서 16p',
        details: [
            '🖥️ 베스트케어 시스템 접속',
            '메뉴: 결의관리 진입',
            '해당 입금 건 확인 및 선택',
            '"수입결의 등록" 버튼 클릭',
            '"수입결의서 조회" 에서 결의서 출력',
            '📝 총 3가지 증빙을 묶어 제출:',
            '  ① 연구비 종합관리 시스템 결의서',
            '  ② 베스트케어 결의서',
            '  ③ eBranch 입출금명세서',
            '⚠️ 수기 결재 (전산 결재 아님!)',
            '결재 라인: 실장 → 파트장 → 부원장 → 융의원장',
            '결재 완료 후 재무팀에 제출'
        ],
        requiredDocs: ['연구비종합관리 결의서', '베스트케어 결의서', '입출금명세서 (eBranch)'],
        relatedDocs: ['resolution', 'bank_statement'],
        approvalLine: '실장 → 파트장 → 부원장 → 융의원장',
        quiz: {
            question: '유형A 수입 처리 시 수기 결재 라인의 순서는?',
            options: [
                '실장 → 부원장 → 융의원장',
                '실장 → 파트장 → 부원장 → 융의원장',
                '파트장 → 실장 → 부원장',
                '실장 → 파트장 → 병원장'
            ],
            answer: 1
        }
    },
    {
        id: 'revenue_deposit_b',
        order: 0.3,
        group: 'revenue',
        title: '[유형B] 병원 대응 자금 입금',
        icon: '🏥',
        system: 'eBranch → 연구비 종합관리 → 베스트케어',
        systemUrl: '',
        description: '병원 대응 자금 입금 처리. 절차는 유형A와 동일하나 결재 라인이 다릅니다.',
        refPage: '인수인계서 14~16p',
        details: [
            '처리 절차는 유형A (한국연구재단)와 동일합니다:',
            '① eBranch에서 입금 확인 및 입출금명세서 출력',
            '② 연구비 종합관리 시스템에서 수입결의 등록 및 전자결재',
            '③ 베스트케어에서 2차 수입결의서 작성',
            '④ 3종 증빙 묶어 수기 결재 후 재무팀 제출',
            '',
            '⚠️ 결재 라인이 유형A와 다릅니다!',
            '유형A: 실장 → 파트장 → 부원장 → 융의원장',
            '유형B: 실장 → 파트장 → 융의원장 → 병원장 → 의료원장',
            '(병원장, 의료원장 결재가 추가됩니다)'
        ],
        requiredDocs: ['입출금명세서', '연구비종합관리 결의서', '베스트케어 결의서'],
        relatedDocs: ['resolution', 'bank_statement'],
        approvalLine: '실장 → 파트장 → 융의원장 → 병원장 → 의료원장',
        quiz: {
            question: '유형B (병원 대응 자금)의 결재 라인에서 유형A와 다른 점은?',
            options: [
                '파트장이 빠진다',
                '부원장 대신 병원장, 의료원장이 추가된다',
                '실장이 빠진다',
                '전자결재로 변경된다'
            ],
            answer: 1
        }
    },

    // ========================================
    // 그룹 B: 경비 지출 처리 (인수인계서 기준)
    // ========================================
    {
        id: 'budget_check',
        order: 1,
        group: 'expense',
        groupTitle: 'B. 경비 지출 처리',
        title: '예산 확인 및 사전 검토',
        icon: '💰',
        system: '지출내역 엑셀 (로컬)',
        description: '지출내역 엑셀에서 예산 항목별 잔여액을 확인하고 집행 가능 여부를 검토합니다.',
        details: [
            '🖥️ 지출내역 엑셀 파일 열기 (2025년 ER바이오코어사업단 지출내역.xls)',
            '재원 구분 확인: 국고 / 병원 대응',
            '지출비목 확인: 내부인건비, 연구활동비, 연구재료비, 연구시설장비비 등',
            '세세목까지 확인하여 정확한 예산 항목에 집행',
            '이미 집행된 금액과 잔여 예산을 비교합니다'
        ],
        requiredDocs: ['지출내역 엑셀'],
        relatedDocs: ['expense_ledger'],
        quiz: {
            question: '경비 집행 전 가장 먼저 확인해야 할 사항은?',
            options: ['견적서 수집', '세금계산서 발행 요청', '예산 잔여액 및 비목 확인', '결의서 작성'],
            answer: 2
        }
    },
    {
        id: 'approval',
        order: 2,
        group: 'expense',
        title: '내부 품의 (사전 승인)',
        icon: '✍️',
        system: '그룹웨어 / HWP',
        description: '내부 품의서를 작성하여 사전 승인을 받습니다. 견적서 비교가 필요합니다.',
        details: [
            '🖥️ 그룹웨어 또는 HWP에서 품의서 작성',
            '금액, 업체명, 수행 기간 등을 기재',
            '견적서를 첨부 (2개 이상 비교견적 필요)',
            '품의서를 결재선에 따라 승인 요청',
            '품의서에는 재원(국고/병원), 지출비목, 세세목 명시'
        ],
        requiredDocs: ['내부품의서', '견적서 (최소 2개 업체)', '비교견적서'],
        relatedDocs: ['internal_approval', 'quotation', 'comparison_quote'],
        quiz: {
            question: '내부 품의 시 견적서는 최소 몇 개 업체에서 받아야 하나요?',
            options: ['1개', '2개', '3개', '4개'],
            answer: 1
        }
    },
    {
        id: 'execution',
        order: 3,
        group: 'expense',
        title: '집행 / 계약 체결',
        icon: '📝',
        system: '오프라인 (업체 직접 계약)',
        description: '품의 승인 후 업체와 계약을 체결합니다. 용역의 경우 계약이행 보증각서를 받습니다.',
        details: [
            '용역 계약서 또는 구매 계약서를 체결 (오프라인)',
            '용역의 경우 계약이행 보증각서를 수령',
            '업체로부터 사업자등록증, 통장사본을 수령',
            '카드 결제의 경우 법인카드 사용 내역 정리',
            '처리유형: 청구서작성 / 청구서작성 카드 구분'
        ],
        requiredDocs: ['용역계약서 또는 구매계약서', '계약이행 보증각서', '사업자등록증', '통장사본'],
        relatedDocs: ['contract', 'guarantee', 'business_registration', 'bank_account'],
        quiz: {
            question: '다음 중 용역 계약 시 업체로부터 수령해야 하는 서류가 아닌 것은?',
            options: ['계약이행 보증각서', '사업자등록증', '지출결의서', '통장사본'],
            answer: 2
        }
    },
    {
        id: 'receipt',
        order: 4,
        group: 'expense',
        title: '증빙서류 수집',
        icon: '📎',
        system: '국세청 홈택스 / 업체',
        description: '세금계산서, 거래명세서, 검수사진 등 증빙서류를 수집합니다.',
        details: [
            '🖥️ 국세청 홈택스 접속 → 전자세금계산서 확인/출력 (XML/HTML/PDF)',
            '거래명세서를 업체로부터 수령',
            '물품의 경우 검수사진 촬영 + 검수보고서(HWP) 작성',
            '카드 사용 시 카드매출전표 보관',
            '증빙일자를 정확하게 기록 (엑셀 증빙일자 컬럼에 해당)'
        ],
        requiredDocs: ['전자세금계산서 (PDF/HTML/XML)', '거래명세서', '검수사진/검수보고서 (HWP)', '납품확인서'],
        relatedDocs: ['tax_invoice', 'transaction_statement', 'inspection_photo'],
        quiz: {
            question: '전자세금계산서는 어디서 확인할 수 있나요?',
            options: ['은행 홈페이지', '국세청 홈택스', '사업단 내부 시스템', '업체 직접 발행'],
            answer: 1
        }
    },
    {
        id: 'resolution',
        order: 5,
        group: 'expense',
        title: '결의서 작성',
        icon: '📄',
        system: '베스트케어 시스템',
        description: '베스트케어 시스템에서 지출결의서/수입결의서/대체결의서를 작성합니다.',
        details: [
            '🖥️ 베스트케어 시스템 접속 → 결의관리 메뉴',
            '결의서 유형 선택: 지출결의 / 수입결의 / 대체결의',
            '지출결의서: 물품 구매, 용역비, 카드대금, 연구재료비, 장비 등',
            '수입결의서: 병원대응자금 입금, 카드환불, 이자수입 등',
            '대체결의서: 인건비, 퇴직충당금, 이자수입 대체 등',
            '결의서에 금액(공급가액 + 부가세), 적요, 계정과목 기재',
            '모든 증빙서류를 결의서에 첨부하고 결의번호 부여'
        ],
        requiredDocs: ['지출결의서/수입결의서/대체결의서'],
        relatedDocs: ['resolution'],
        docTypes: {
            '지출결의서': {
                description: '물품 구매, 용역비, 카드대금 등 지출 시 작성',
                examples: ['기술사업화 컨설팅비', '연구재료비', '장비 구매비', '월별 카드대금']
            },
            '수입결의서': {
                description: '연구비 입금, 환불금 수입 시 작성',
                examples: ['병원대응자금 입금(150,000,000원)', '카드 환불 입금', '이자 수입']
            },
            '대체결의서': {
                description: '계정 간 대체, 인건비, 퇴직충당금 등에 사용',
                examples: ['상/하반기 인건비', '퇴직충당금(3~4명분)', '이자수입 대체']
            }
        },
        quiz: {
            question: '인건비 처리 시 사용하는 결의서 유형은?',
            options: ['지출결의서', '수입결의서', '대체결의서', '입금결의서'],
            answer: 2
        }
    },
    {
        id: 'payment',
        order: 6,
        group: 'expense',
        title: '결재 및 대금 지급',
        icon: '🏦',
        system: 'eBranch (기업은행) / 그룹웨어',
        description: '결의서를 결재받고 eBranch에서 대금을 이체합니다. 입출금명세서를 출력 보관합니다.',
        details: [
            '🖥️ 그룹웨어에서 결의서 결재선 승인 요청',
            '승인 완료 후 eBranch(기업은행) 접속',
            '기업은행(55402028004050)에서 업체 계좌로 대금 이체',
            '🖥️ eBranch에서 입출금명세서 출력 → 보관',
            '카드 대금의 경우 카드사 결제일에 자동 출금',
            '이체일자를 엑셀에 기록',
            '문서번호와 결의번호를 엑셀에 기록'
        ],
        requiredDocs: ['결재 완료된 결의서', '입출금명세서'],
        relatedDocs: ['bank_statement'],
        quiz: {
            question: '대금 지급 후 반드시 보관해야 하는 서류는?',
            options: ['견적서', '입출금명세서', '사업자등록증', '계약서'],
            answer: 1
        }
    },
    {
        id: 'filing',
        order: 7,
        group: 'expense',
        title: '정산 / 기록 / 보관',
        icon: '🗂️',
        system: '지출내역 엑셀 / OneDrive',
        description: '지출내역 엑셀에 최종 기록하고, 증빙서류를 체계적으로 보관합니다.',
        details: [
            '🖥️ 지출내역 엑셀 파일 열기',
            '23개 컬럼을 모두 입력',
            '진행구분을 "승인"으로 업데이트',
            '결의서 원본을 스캔하여 PDF로 보관',
            '증빙 묶음을 건별로 정리: 결의서 + 세금계산서 + 거래명세서 + 증빙',
            '연차보고서 작성 시 참조할 수 있도록 비목별 분류',
            '🖥️ OneDrive 사업단 예산 관리 폴더에 백업'
        ],
        requiredDocs: ['지출내역 엑셀 (업데이트)', '스캔된 결의서 PDF', '증빙 묶음 ZIP'],
        relatedDocs: ['expense_ledger'],
        quiz: {
            question: '증빙서류 보관 시 올바른 분류 방법은?',
            options: ['날짜별 일괄 보관', '건별로 결의서+증빙 묶어 보관', '업체별 보관', '금액별 보관'],
            answer: 1
        }
    }
];

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
            { step: 5, action: '지출결의서 작성', instruction: '지출결의서를 작성하세요.', formType: 'expense_resolution' },
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
            { step: 5, action: '지출결의서 작성', instruction: '기술사업화 컨설팅비 지출결의서를 작성하세요.', formType: 'expense_resolution' },
            { step: 6, action: '결재 및 지급', instruction: '결의서를 결재받고 업체별로 대금을 이체합니다.' }
        ]
    },
    {
        id: 'card_settlement',
        title: '월별 카드대금 정산',
        icon: '💳',
        difficulty: '초급',
        description: '법인카드 사용 후 월별 카드대금 결의서 작성 시나리오 (처리유형: 청구서작성 카드)',
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
            { step: 3, action: '지출결의서 작성', instruction: '월별 카드대금 지출결의서를 작성하세요.', formType: 'expense_resolution' },
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
            { step: 6, action: '증빙 수집 및 결의서', instruction: '세금계산서, 거래명세서를 받고 지출결의서를 작성하세요.', formType: 'expense_resolution' },
            { step: 7, action: '이체 및 엑셀 기록', instruction: '대금을 이체하고 23개 컬럼 엑셀에 기록합니다.' }
        ]
    }
];

// 양식 필드 정의 (엑셀 컬럼 매칭)
const FORM_FIELDS = {
    expense_resolution: {
        title: '지출결의서',
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
            { id: 'accountTitle', label: '계정과목', type: 'select', required: true, options: ['내부인건비', '퇴직충당금', '이자수입'] },
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

export { WORKFLOW_STEPS, SCENARIOS, FORM_FIELDS, DOCUMENT_TYPES, EXCEL_COLUMNS };
