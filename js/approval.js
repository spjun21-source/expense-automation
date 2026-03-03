// ============================================================
// 사업단 경비 처리 자동화 - Approval Module (v5)
// ============================================================

import { FORM_FIELDS } from './data.js';

class ApprovalManager {
  constructor(store) {
    this.store = store;
  }

  // ---- 결재 대기 목록 렌더링 ----
  renderPendingList(container) {
    if (!container) return;
    const pending = this.store.getPending();
    container.innerHTML = `
      <div class="approval-section">
        <div class="approval-header">
          <h3>📋 결재 대기 문서 <span class="pending-badge">${pending.length}건</span></h3>
        </div>
        ${pending.length === 0 ? '<div class="approval-empty">결재 대기 중인 문서가 없습니다 ✅</div>' :
        `<div class="approval-list">${pending.map(doc => this._renderDocCard(doc)).join('')}</div>`}
      </div>
    `;
    this._bindApprovalEvents(container);
  }

  _renderDocCard(doc) {
    const formDef = FORM_FIELDS[doc.formType];
    const title = formDef?.title || doc.formType;
    const dateStr = new Date(doc.createdat || doc.createdAt).toLocaleDateString('ko-KR');
    return `
      <div class="approval-card" data-doc-id="${doc.id}">
        <div class="approval-card-header">
          <span class="approval-type">${title}</span>
          <span class="approval-date">${dateStr}</span>
        </div>
        <div class="approval-card-info">
          <span class="approval-author">작성자: ${doc.authorName}</span>
          <span class="approval-desc">${doc.data.description || doc.data.incomeDesc || '-'}</span>
          ${doc.data.amount ? `<span class="approval-amount">${parseInt(doc.data.amount).toLocaleString()}원</span>` : ''}
        </div>
        <div class="approval-card-actions">
          <button class="btn btn-sm btn-outline" data-action="view" data-id="${doc.id}">상세보기</button>
          <div class="approval-action-group">
            <input class="approval-comment-input" placeholder="코멘트 (선택)" data-comment-for="${doc.id}">
            <button class="btn btn-sm btn-success" data-action="approve" data-id="${doc.id}">✅ 승인</button>
            <button class="btn btn-sm btn-danger" data-action="reject" data-id="${doc.id}">❌ 반려</button>
          </div>
        </div>
        <div class="approval-detail-panel" id="detail_${doc.id}" style="display:none;">
          ${this._renderDocDetail(doc)}
        </div>
      </div>`;
  }

  _renderDocDetail(doc) {
    const formDef = FORM_FIELDS[doc.formType];
    if (!formDef) return '<p>양식 정보 없음</p>';
    let rows = formDef.fields.map(f => {
      const val = doc.data[f.id];
      let display = '-';
      if (Array.isArray(val)) display = val.join(', ') || '-';
      else if (val) display = f.type === 'number' ? parseInt(val).toLocaleString() + '원' : val;
      return `<tr><th>${f.label}</th><td>${display}</td></tr>`;
    }).join('');
    return `<table class="approval-detail-table"><tbody>${rows}</tbody></table>`;
  }

  _bindApprovalEvents(container) {
    container.querySelectorAll('[data-action]').forEach(btn => {
      btn.addEventListener('click', async () => {
        const action = btn.dataset.action;
        const id = btn.dataset.id;

        if (action === 'view') {
          const panel = container.querySelector(`#detail_${id}`);
          if (panel) panel.style.display = panel.style.display === 'none' ? 'block' : 'none';
          return;
        }

        const commentInput = container.querySelector(`[data-comment-for="${id}"]`);
        const comment = commentInput?.value || '';
        const adminUser = window.app?.auth?.getCurrentUser();
        if (!adminUser) return;

        let result;
        if (action === 'approve') {
          result = await this.store.approve(id, adminUser, comment);
        } else if (action === 'reject') {
          result = await this.store.reject(id, adminUser, comment);
        }

        if (result?.success) {
          window.app?.showToast(action === 'approve' ? '✅ 승인 처리되었습니다.' : '❌ 반려 처리되었습니다.', 'success');
          this.renderPendingList(container);
          window.app?.updatePendingBadge();
        } else {
          window.app?.showToast(result?.error || '처리 실패', 'error');
        }
      });
    });
  }

  // ---- 결재 완료 이력 ----
  renderHistory(container) {
    if (!container) return;
    const docs = this.store.getAll().filter(d => d.status === '승인' || d.status === '반려');
    container.innerHTML = `
      <div class="approval-section">
        <h3>📜 결재 이력</h3>
        ${docs.length === 0 ? '<div class="approval-empty">결재 이력이 없습니다.</div>' :
        `<div class="approval-history-list">
            ${docs.map(doc => {
          const formDef = FORM_FIELDS[doc.formType];
          const statusClass = doc.status === '승인' ? 'approved' : 'rejected';
          return `<div class="approval-history-item ${statusClass}">
                <div class="history-status"><span class="status-badge ${statusClass}">${doc.status}</span></div>
                <div class="history-info">
                  <span class="history-title">${formDef?.title || doc.formType}</span>
                  <span class="history-author">${doc.authorName}</span>
                  <span class="history-desc">${doc.data.description || doc.data.incomeDesc || '-'}</span>
                </div>
                <div class="history-meta">
                  <span>결재자: ${doc.approvedBy}</span>
                  <span>${doc.approvedAt ? new Date(doc.approvedAt).toLocaleDateString('ko-KR') : ''}</span>
                  ${doc.approvalComment ? `<span class="history-comment">"${doc.approvalComment}"</span>` : ''}
                </div>
              </div>`;
        }).join('')}
          </div>`}
      </div>`;
  }

  // ---- 사용자 관리 렌더링 ----
  async renderUserManagement(container, auth) {
    if (!container) return;
    const users = await auth.getUsers();
    container.innerHTML = `
      <div class="usermgmt-section">
        <h3>👥 사용자 관리</h3>
        <div class="usermgmt-add">
          <input class="form-input" id="newUserId" placeholder="아이디">
          <input class="form-input" id="newUserPw" placeholder="비밀번호" type="password">
          <input class="form-input" id="newUserName" placeholder="이름">
          <input class="form-input" id="newUserDept" placeholder="부서">
          <select class="form-select" id="newUserRole">
            <option value="user">사용자</option>
            <option value="admin">관리자</option>
          </select>
          <button class="btn btn-primary btn-sm" id="addUserBtn">등록</button>
        </div>
        <div class="usermgmt-list">
          <table class="usermgmt-table">
            <thead><tr><th>ID</th><th>이름</th><th>부서</th><th>역할</th><th>관리</th></tr></thead>
            <tbody>
              ${users.map(u => `<tr>
                <td>${u.id}</td><td>${u.name}</td><td>${u.dept}</td>
                <td><span class="role-badge ${u.role}">${u.role === 'admin' ? '관리자' : '사용자'}</span></td>
                <td>
                  <button class="btn btn-sm btn-outline" data-action="edituser" data-uid="${u.id}">수정</button>
                  ${u.id === 'admin' ? '' : `<button class="btn btn-sm btn-danger" data-action="deluser" data-uid="${u.id}">삭제</button>`}
                </td>
              </tr>`).join('')}
            </tbody>
          </table>
        </div>
      </div>`;

    container.querySelector('#addUserBtn')?.addEventListener('click', async () => {
      const id = document.getElementById('newUserId')?.value;
      const pw = document.getElementById('newUserPw')?.value;
      const name = document.getElementById('newUserName')?.value;
      const dept = document.getElementById('newUserDept')?.value;
      const role = document.getElementById('newUserRole')?.value;
      if (!id || !pw || !name) {
        window.app?.showToast('아이디, 비밀번호, 이름은 필수입니다.', 'error');
        return;
      }
      const result = await auth.register(id, pw, name, dept || '', role);
      if (result.success) {
        window.app?.showToast(`✅ '${name}' 사용자가 등록되었습니다.`, 'success');
        this.renderUserManagement(container, auth);
      } else {
        window.app?.showToast(result.error, 'error');
      }
    });

    container.querySelectorAll('[data-action="deluser"]').forEach(btn => {
      btn.addEventListener('click', async () => {
        const uid = btn.dataset.uid;
        if (confirm(`'${uid}' 사용자를 삭제하시겠습니까?`)) {
          const result = await auth.deleteUser(uid);
          if (result.success) {
            window.app?.showToast('삭제되었습니다.', 'success');
            this.renderUserManagement(container, auth);
          }
        }
      });
    });

    container.querySelectorAll('[data-action="edituser"]').forEach(btn => {
      btn.addEventListener('click', async () => {
        const uid = btn.dataset.uid;
        const users = await auth.getUsers();
        const user = users.find(u => u.id === uid);
        if (user) this.showEditUserModal(user, auth, () => this.renderUserManagement(container, auth));
      });
    });
  }

  showEditUserModal(user, auth, onUpdate) {
    const modal = document.createElement('div');
    modal.className = 'modal active';
    modal.innerHTML = `
      <div class="modal-content">
        <div class="modal-header">
          <h2 class="modal-title">👤 사용자 정보 수정</h2>
          <button class="modal-close">&times;</button>
        </div>
        <div class="modal-body">
            <div class="form-group" style="margin-bottom:12px;">
                <label class="form-label">아이디</label>
                <input class="form-input" value="${user.id}" disabled>
            </div>
            <div class="form-group" style="margin-bottom:12px;">
                <label class="form-label">비밀번호 (변경 시에만 입력)</label>
                <input class="form-input" id="editUserPw" type="password" placeholder="********">
            </div>
            <div class="form-group" style="margin-bottom:12px;">
                <label class="form-label">이름</label>
                <input class="form-input" id="editUserName" value="${user.name}">
            </div>
            <div class="form-group" style="margin-bottom:12px;">
                <label class="form-label">부서</label>
                <input class="form-input" id="editUserDept" value="${user.dept || ''}">
            </div>
            <div class="form-group" style="margin-bottom:12px;">
                <label class="form-label">역할</label>
                <select class="form-select" id="editUserRole">
                    <option value="user" ${user.role === 'user' ? 'selected' : ''}>사용자</option>
                    <option value="admin" ${user.role === 'admin' ? 'selected' : ''}>관리자</option>
                </select>
            </div>
        </div>
        <div class="modal-footer">
          <button class="btn btn-outline btn-modal-close">취소</button>
          <button class="btn btn-primary" id="saveUserBtn">저장하기</button>
        </div>
      </div>
    `;
    document.body.appendChild(modal);

    const close = () => {
      modal.classList.remove('active');
      setTimeout(() => modal.remove(), 300);
    };

    modal.querySelector('.modal-close').onclick = close;
    modal.querySelector('.btn-modal-close').onclick = close;
    modal.querySelector('#saveUserBtn').onclick = async () => {
      const password = modal.querySelector('#editUserPw').value || undefined;
      const name = modal.querySelector('#editUserName').value;
      const dept = modal.querySelector('#editUserDept').value;
      const role = modal.querySelector('#editUserRole').value;

      if (!name) {
        window.app?.showToast('이름은 필수입니다.', 'error');
        return;
      }

      const result = await auth.updateUser(user.id, { password, name, dept, role });
      if (result.success) {
        window.app?.showToast('✅ 정보가 수정되었습니다.', 'success');
        onUpdate();
        close();
      } else {
        window.app?.showToast(result.error, 'error');
      }
    };
  }
}

export { ApprovalManager };
