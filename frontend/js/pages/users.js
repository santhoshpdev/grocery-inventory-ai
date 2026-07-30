let usersList = [];

const ROLE_DISPLAY = {
  'SYSTEM_ADMIN': { label: 'System Admin', class: 'role-admin' },
  'INVENTORY_MANAGER': { label: 'Inventory Manager', class: 'role-manager' },
  'INVENTORY_ANALYST': { label: 'Inventory Analyst', class: 'role-analyst' },
};

function renderUsers(container) {
  if (!hasRole(['SYSTEM_ADMIN'])) {
    container.innerHTML = `
      <div class="card" style="text-align:center;padding:60px 20px">
        <i class="fas fa-lock" style="font-size:48px;color:var(--danger);margin-bottom:16px;display:block"></i>
        <h3 style="color:var(--text);margin-bottom:8px">Access Denied</h3>
        <p style="color:var(--text-muted);max-width:400px;margin:0 auto">You do not have permission to access User Management. Contact your System Administrator.</p>
      </div>
    `;
    document.getElementById('page-subtitle').textContent = 'Administrative User Management';
    return;
  }

  container.innerHTML = `
    <div class="card">
      <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:20px;flex-wrap:wrap;gap:12px">
        <div>
          <div class="card-title" style="font-size:18px"><i class="fas fa-users-cog" style="margin-right:8px;color:var(--primary)"></i>User Management</div>
          <div class="card-subtitle" style="font-size:12px">Manage system users, roles, and access permissions</div>
        </div>
        <button class="btn btn-primary" onclick="showCreateUserModal()">
          <i class="fas fa-plus"></i> Create User
        </button>
      </div>
      <div class="search-bar">
        <input type="text" class="search-input" id="users-search" placeholder="Search by username..." />
      </div>
      <div id="users-stats" style="display:flex;gap:16px;margin-bottom:16px;flex-wrap:wrap"></div>
      <div id="users-table-container"><div class="loading-screen" style="min-height:200px"><div class="loader-ring"></div></div></div>
    </div>

    <div class="modal-overlay" id="create-user-modal">
      <div class="modal" style="max-width:500px">
        <div class="modal-header">
          <div class="modal-title">Create User</div>
          <button class="modal-close" onclick="document.getElementById('create-user-modal').classList.remove('open')">&times;</button>
        </div>
        <div class="modal-body">
          <form id="create-user-form" onsubmit="return handleCreateUser(event)">
            <div class="form-group" style="margin-bottom:14px">
              <label>Username</label>
              <input type="text" id="cu-username" placeholder="Enter username" required minlength="3" />
            </div>
            <div class="form-group" style="margin-bottom:14px">
              <label>Password</label>
              <input type="password" id="cu-password" placeholder="Enter password" required minlength="6" />
            </div>
            <div class="form-group" style="margin-bottom:14px">
              <label>Confirm Password</label>
              <input type="password" id="cu-confirm" placeholder="Confirm password" required />
            </div>
            <div class="form-group" style="margin-bottom:14px">
              <label>Role</label>
              <select id="cu-role" required>
                <option value="INVENTORY_MANAGER">Inventory Manager</option>
                <option value="INVENTORY_ANALYST">Inventory Analyst</option>
              </select>
            </div>
            <div class="form-group" style="margin-bottom:20px">
              <label>Status</label>
              <select id="cu-status">
                <option value="true">Active</option>
                <option value="false">Inactive</option>
              </select>
            </div>
            <div id="cu-error" class="login-error" style="display:none"></div>
            <div style="display:flex;gap:10px;justify-content:flex-end">
              <button type="button" class="btn btn-outline" onclick="document.getElementById('create-user-modal').classList.remove('open')">Cancel</button>
              <button type="submit" class="btn btn-primary" id="cu-submit-btn">Create User</button>
            </div>
          </form>
        </div>
      </div>
    </div>

    <div class="modal-overlay" id="edit-user-modal">
      <div class="modal" style="max-width:500px">
        <div class="modal-header">
          <div class="modal-title" id="edit-modal-title">Edit User</div>
          <button class="modal-close" onclick="document.getElementById('edit-user-modal').classList.remove('open')">&times;</button>
        </div>
        <div class="modal-body">
          <form id="edit-user-form" onsubmit="return handleEditUser(event)">
            <input type="hidden" id="eu-user-id" />
            <div class="form-group" style="margin-bottom:14px">
              <label>Username</label>
              <input type="text" id="eu-username" disabled style="opacity:0.6" />
            </div>
            <div class="form-group" style="margin-bottom:14px">
              <label>Role</label>
              <select id="eu-role" required></select>
            </div>
            <div class="form-group" style="margin-bottom:20px">
              <label>Status</label>
              <select id="eu-status">
                <option value="true">Active</option>
                <option value="false">Inactive</option>
              </select>
            </div>
            <div id="eu-error" class="login-error" style="display:none"></div>
            <div style="display:flex;gap:10px;justify-content:flex-end">
              <button type="button" class="btn btn-outline" onclick="document.getElementById('edit-user-modal').classList.remove('open')">Cancel</button>
              <button type="submit" class="btn btn-primary" id="eu-submit-btn">Save Changes</button>
            </div>
          </form>
        </div>
      </div>
    </div>

    <div class="modal-overlay" id="password-modal">
      <div class="modal" style="max-width:500px">
        <div class="modal-header">
          <div class="modal-title" id="password-modal-title">Change Password</div>
          <button class="modal-close" onclick="document.getElementById('password-modal').classList.remove('open')">&times;</button>
        </div>
        <div class="modal-body">
          <form id="password-form" onsubmit="return handleChangePassword(event)">
            <input type="hidden" id="pw-user-id" />
            <p style="color:var(--text-muted);font-size:13px;margin-bottom:16px" id="pw-username-label">Changing password for user</p>
            <div class="form-group" style="margin-bottom:14px">
              <label>New Password</label>
              <input type="password" id="pw-new" placeholder="Enter new password" required minlength="6" />
            </div>
            <div class="form-group" style="margin-bottom:20px">
              <label>Confirm New Password</label>
              <input type="password" id="pw-confirm" placeholder="Confirm new password" required />
            </div>
            <div id="pw-error" class="login-error" style="display:none"></div>
            <div style="display:flex;gap:10px;justify-content:flex-end">
              <button type="button" class="btn btn-outline" onclick="document.getElementById('password-modal').classList.remove('open')">Cancel</button>
              <button type="submit" class="btn btn-primary" id="pw-submit-btn">Update Password</button>
            </div>
          </form>
        </div>
      </div>
    </div>
  `;

  document.getElementById('users-search').addEventListener('input', debounce(filterUsers, 300));
  loadUsers();
}

async function loadUsers() {
  try {
    const users = await API.users();
    usersList = users;
    renderUsersStats(users);
    renderUsersTable(users);
  } catch (err) {
    document.getElementById('users-table-container').innerHTML = `
      <div class="empty-state">
        <i class="fas fa-exclamation-circle"></i>
        <h3>Failed to load users</h3>
        <p>${err.message}</p>
        <button class="btn btn-outline mt-16" onclick="loadUsers()"><i class="fas fa-redo"></i> Retry</button>
      </div>
    `;
  }
}

function renderUsersStats(users) {
  const active = users.filter(u => u.is_active).length;
  const inactive = users.filter(u => !u.is_active).length;
  document.getElementById('users-stats').innerHTML = `
    <div class="filter-pill" style="background:var(--primary-glow);border-color:rgba(5,150,105,0.2);color:var(--primary-light)">
      <i class="fas fa-users"></i> Total: ${users.length}
    </div>
    <div class="filter-pill" style="background:var(--success-bg);border-color:rgba(16,185,129,0.2);color:var(--success)">
      <i class="fas fa-check-circle"></i> Active: ${active}
    </div>
    <div class="filter-pill" style="background:var(--danger-bg);border-color:rgba(239,68,68,0.2);color:var(--danger)">
      <i class="fas fa-minus-circle"></i> Inactive: ${inactive}
    </div>
  `;
}

function filterUsers() {
  const q = document.getElementById('users-search').value.toLowerCase();
  const filtered = usersList.filter(u => u.username.toLowerCase().includes(q));
  renderUsersTable(filtered);
}

function renderUsersTable(users) {
  const el = document.getElementById('users-table-container');
  if (!users || users.length === 0) {
    el.innerHTML = `<div class="empty-state"><i class="fas fa-users"></i><h3>No users found</h3></div>`;
    return;
  }
  el.innerHTML = `
    <div class="table-container">
      <table>
        <thead><tr><th>Username</th><th>Role</th><th>Status</th><th>Created</th><th></th></tr></thead>
        <tbody>
          ${users.map(u => `
            <tr>
              <td style="font-weight:600"><i class="fas fa-user" style="color:var(--text-muted);margin-right:8px;font-size:12px"></i>${u.username}</td>
              <td><span class="role-badge ${ROLE_DISPLAY[u.role]?.class || ''}">${ROLE_DISPLAY[u.role]?.label || u.role}</span></td>
              <td>${u.is_active 
                ? '<span class="status-indicator-user active"><span class="status-dot-user"></span> Active</span>' 
                : '<span class="status-indicator-user inactive"><span class="status-dot-user offline"></span> Inactive</span>'
              }</td>
              <td style="color:var(--text-muted);font-size:13px">${new Date(u.created_at).toLocaleDateString()}</td>
              <td>
                <div class="user-actions">
                  <button class="user-action-btn" onclick="showEditUserModal(${u.id})" title="Edit User"><i class="fas fa-edit"></i></button>
                  <button class="user-action-btn" onclick="showPasswordModal(${u.id})" title="Change Password"><i class="fas fa-key"></i></button>
                  <button class="user-action-btn" onclick="toggleUserStatus(${u.id})" title="${u.is_active ? 'Deactivate' : 'Activate'}">
                    ${u.is_active ? '<i class="fas fa-ban" style="color:var(--warning)"></i>' : '<i class="fas fa-check-circle" style="color:var(--success)"></i>'}
                  </button>
                </div>
              </td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>
  `;
}

function showCreateUserModal() {
  document.getElementById('create-user-modal').classList.add('open');
  document.getElementById('cu-username').value = '';
  document.getElementById('cu-password').value = '';
  document.getElementById('cu-confirm').value = '';
  document.getElementById('cu-role').value = 'INVENTORY_MANAGER';
  document.getElementById('cu-status').value = 'true';
  document.getElementById('cu-error').style.display = 'none';
}

async function handleCreateUser(event) {
  event.preventDefault();
  const username = document.getElementById('cu-username').value.trim();
  const password = document.getElementById('cu-password').value;
  const confirm = document.getElementById('cu-confirm').value;
  const role = document.getElementById('cu-role').value;
  const isActive = document.getElementById('cu-status').value === 'true';
  const errorEl = document.getElementById('cu-error');

  if (password !== confirm) {
    errorEl.textContent = 'Passwords do not match';
    errorEl.style.display = 'block';
    return false;
  }
  if (username.length < 3) {
    errorEl.textContent = 'Username must be at least 3 characters';
    errorEl.style.display = 'block';
    return false;
  }
  if (password.length < 6) {
    errorEl.textContent = 'Password must be at least 6 characters';
    errorEl.style.display = 'block';
    return false;
  }

  const btn = document.getElementById('cu-submit-btn');
  btn.disabled = true;
  btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Creating...';
  errorEl.style.display = 'none';

  try {
    await API.createUser({ username, password, role, is_active: isActive });
    document.getElementById('create-user-modal').classList.remove('open');
    showToast('User created successfully', 'success');
    loadUsers();
  } catch (err) {
    errorEl.textContent = err.message;
    errorEl.style.display = 'block';
  } finally {
    btn.disabled = false;
    btn.innerHTML = 'Create User';
  }
  return false;
}

async function showEditUserModal(userId) {
  const user = usersList.find(u => u.id === userId);
  if (!user) return;
  const modal = document.getElementById('edit-user-modal');
  document.getElementById('eu-user-id').value = userId;
  document.getElementById('eu-username').value = user.username;
  document.getElementById('edit-modal-title').textContent = `Edit User — ${user.username}`;

  const roleSelect = document.getElementById('eu-role');
  const roles = ['INVENTORY_MANAGER', 'INVENTORY_ANALYST'];
  if (user.role === 'SYSTEM_ADMIN') {
    roles.unshift('SYSTEM_ADMIN');
  }
  roleSelect.innerHTML = roles.map(r => `<option value="${r}" ${r === user.role ? 'selected' : ''}>${ROLE_DISPLAY[r]?.label || r}</option>`).join('');

  document.getElementById('eu-status').value = user.is_active ? 'true' : 'false';
  document.getElementById('eu-error').style.display = 'none';
  modal.classList.add('open');
}

async function handleEditUser(event) {
  event.preventDefault();
  const userId = parseInt(document.getElementById('eu-user-id').value);
  const role = document.getElementById('eu-role').value;
  const isActive = document.getElementById('eu-status').value === 'true';
  const errorEl = document.getElementById('eu-error');
  const btn = document.getElementById('eu-submit-btn');

  btn.disabled = true;
  btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Saving...';
  errorEl.style.display = 'none';

  try {
    const data = await API.updateUser(userId, { role });
    if (data.is_active !== isActive) {
      await API.updateUserStatus(userId, { is_active: isActive });
    }
    document.getElementById('edit-user-modal').classList.remove('open');
    showToast('User updated successfully', 'success');
    loadUsers();
  } catch (err) {
    errorEl.textContent = err.message;
    errorEl.style.display = 'block';
  } finally {
    btn.disabled = false;
    btn.innerHTML = 'Save Changes';
  }
  return false;
}

async function showPasswordModal(userId) {
  const user = usersList.find(u => u.id === userId);
  if (!user) return;
  document.getElementById('pw-user-id').value = userId;
  document.getElementById('password-modal-title').textContent = `Change Password`;
  document.getElementById('pw-username-label').textContent = `Changing password for ${user.username}`;
  document.getElementById('pw-new').value = '';
  document.getElementById('pw-confirm').value = '';
  document.getElementById('pw-error').style.display = 'none';
  document.getElementById('password-modal').classList.add('open');
}

async function handleChangePassword(event) {
  event.preventDefault();
  const userId = parseInt(document.getElementById('pw-user-id').value);
  const newPassword = document.getElementById('pw-new').value;
  const confirm = document.getElementById('pw-confirm').value;
  const errorEl = document.getElementById('pw-error');
  const btn = document.getElementById('pw-submit-btn');

  if (newPassword !== confirm) {
    errorEl.textContent = 'Passwords do not match';
    errorEl.style.display = 'block';
    return false;
  }
  if (newPassword.length < 6) {
    errorEl.textContent = 'Password must be at least 6 characters';
    errorEl.style.display = 'block';
    return false;
  }

  btn.disabled = true;
  btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Updating...';
  errorEl.style.display = 'none';

  try {
    await API.changeUserPassword(userId, { new_password: newPassword });
    document.getElementById('password-modal').classList.remove('open');
    showToast('Password updated successfully', 'success');
  } catch (err) {
    errorEl.textContent = err.message;
    errorEl.style.display = 'block';
  } finally {
    btn.disabled = false;
    btn.innerHTML = 'Update Password';
  }
  return false;
}

async function toggleUserStatus(userId) {
  const user = usersList.find(u => u.id === userId);
  if (!user) return;
  const newStatus = !user.is_active;
  const action = newStatus ? 'activate' : 'deactivate';

  try {
    await API.updateUserStatus(userId, { is_active: newStatus });
    showToast(`User ${action}d successfully`, 'success');
    loadUsers();
  } catch (err) {
    showToast(err.message, 'error');
  }
}
