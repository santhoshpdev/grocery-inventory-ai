let usersList = [];

const ROLE_DISPLAY = {
  'SYSTEM_ADMIN': { label: 'System Admin', class: 'role-admin' },
  'INVENTORY_MANAGER': { label: 'Inventory Manager', class: 'role-manager' },
  'INVENTORY_ANALYST': { label: 'Inventory Analyst', class: 'role-analyst' },
};

function renderUsers(container) {
  if (!hasRole(['SYSTEM_ADMIN'])) {
    container.innerHTML = `
      <div class="card access-denied">
        <i class="fas fa-lock access-denied-icon"></i>
        <h3>Access Denied</h3>
        <p>You do not have permission to access User Management. Contact your System Administrator.</p>
      </div>
    `;
    document.getElementById('page-subtitle').textContent = 'Administrative User Management';
    return;
  }

  container.innerHTML = `
    <div class="card">
      <div class="user-mgmt-header">
        <div>
          <div class="card-title user-mgmt-title"><i class="fas fa-users-cog" style="margin-right:8px;color:var(--primary)"></i>User Management</div>
          <div class="user-mgmt-subtitle">Manage system users, roles, and access permissions</div>
        </div>
        <button class="btn btn-primary" onclick="showCreateUserModal()">
          <i class="fas fa-plus"></i> Create User
        </button>
      </div>
      <div class="search-bar">
        <input type="text" class="search-input" id="users-search" placeholder="Search by username..." />
      </div>
      <div class="users-stats" id="users-stats"></div>
      <div id="users-table-container"><div class="loading-screen" style="min-height:200px"><div class="loader-ring"></div></div></div>
    </div>

    <div class="modal-overlay" id="create-user-modal">
      <div class="modal modal-md">
        <div class="modal-header">
          <div class="modal-title">Create User</div>
          <button class="modal-close" onclick="document.getElementById('create-user-modal').classList.remove('open')">&times;</button>
        </div>
        <div class="modal-body">
          <form id="create-user-form" onsubmit="return handleCreateUser(event)">
            <div class="form-group">
              <label>Username</label>
              <input type="text" id="cu-username" placeholder="Enter username" required minlength="3" />
            </div>
            <div class="form-group">
              <label>Password</label>
              <input type="password" id="cu-password" placeholder="Enter password" required minlength="6" />
            </div>
            <div class="form-group">
              <label>Confirm Password</label>
              <input type="password" id="cu-confirm" placeholder="Confirm password" required />
            </div>
            <div class="form-group">
              <label>Role</label>
              <select id="cu-role" required>
                <option value="INVENTORY_MANAGER">Inventory Manager</option>
                <option value="INVENTORY_ANALYST">Inventory Analyst</option>
              </select>
            </div>
            <div class="form-group">
              <label>Status</label>
              <select id="cu-status">
                <option value="true">Active</option>
                <option value="false">Inactive</option>
              </select>
            </div>
            <div id="cu-error" class="login-error" style="display:none"></div>
            <div class="form-actions">
              <button type="button" class="btn btn-outline" onclick="document.getElementById('create-user-modal').classList.remove('open')">Cancel</button>
              <button type="submit" class="btn btn-primary" id="cu-submit-btn">Create User</button>
            </div>
          </form>
        </div>
      </div>
    </div>

    <div class="modal-overlay" id="edit-user-modal">
      <div class="modal modal-md">
        <div class="modal-header">
          <div class="modal-title" id="edit-modal-title">Edit User</div>
          <button class="modal-close" onclick="document.getElementById('edit-user-modal').classList.remove('open')">&times;</button>
        </div>
        <div class="modal-body">
          <form id="edit-user-form" onsubmit="return handleEditUser(event)">
            <input type="hidden" id="eu-user-id" />
            <div class="form-group">
              <label>Username</label>
              <input type="text" id="eu-username" disabled style="opacity:0.6" />
            </div>
            <div class="form-group">
              <label>Role</label>
              <select id="eu-role" required></select>
            </div>
            <div class="form-group">
              <label>Status</label>
              <select id="eu-status">
                <option value="true">Active</option>
                <option value="false">Inactive</option>
              </select>
            </div>
            <div id="eu-error" class="login-error" style="display:none"></div>
            <div class="form-actions">
              <button type="button" class="btn btn-outline" onclick="document.getElementById('edit-user-modal').classList.remove('open')">Cancel</button>
              <button type="submit" class="btn btn-primary" id="eu-submit-btn">Save Changes</button>
            </div>
          </form>
        </div>
      </div>
    </div>

    <div class="modal-overlay" id="password-modal">
      <div class="modal modal-md">
        <div class="modal-header">
          <div class="modal-title" id="password-modal-title">Change Password</div>
          <button class="modal-close" onclick="document.getElementById('password-modal').classList.remove('open')">&times;</button>
        </div>
        <div class="modal-body">
          <form id="password-form" onsubmit="return handleChangePassword(event)">
            <input type="hidden" id="pw-user-id" />
            <p class="pw-username-label" id="pw-username-label">Changing password for user</p>
            <div class="form-group">
              <label>New Password</label>
              <input type="password" id="pw-new" placeholder="Enter new password" required minlength="6" />
            </div>
            <div class="form-group">
              <label>Confirm New Password</label>
              <input type="password" id="pw-confirm" placeholder="Confirm new password" required />
            </div>
            <div id="pw-error" class="login-error" style="display:none"></div>
            <div class="form-actions">
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

const DEMO_USERS = [
  { id: -1, username: 'demo.manager', role: 'INVENTORY_MANAGER', is_active: true, created_at: new Date().toISOString(), is_demo: true },
  { id: -2, username: 'demo.analyst', role: 'INVENTORY_ANALYST', is_active: true, created_at: new Date().toISOString(), is_demo: true },
];

async function loadUsers() {
  try {
    const realUsers = await API.users();
    const withDemo = [...realUsers, ...DEMO_USERS];
    usersList = withDemo;
    renderUsersStats(withDemo);
    renderUsersTable(withDemo);
  } catch (err) {
    usersList = DEMO_USERS;
    renderUsersStats(DEMO_USERS);
    renderUsersTable(DEMO_USERS);
    document.getElementById('users-table-container').innerHTML += `
      <div style="padding:10px 14px;margin-top:8px;background:var(--warning-bg);border:1px solid rgba(245,158,11,0.2);border-radius:8px;font-size:12px;color:var(--warning)">
        <i class="fas fa-exclamation-triangle"></i> Backend unavailable — showing demo users only.
      </div>
    `;
  }
}

function renderUsersStats(users) {
  const active = users.filter(u => u.is_active).length;
  const inactive = users.filter(u => !u.is_active).length;
  const admins = users.filter(u => u.role === 'SYSTEM_ADMIN').length;
  const managers = users.filter(u => u.role === 'INVENTORY_MANAGER').length;
  const analysts = users.filter(u => u.role === 'INVENTORY_ANALYST').length;
  document.getElementById('users-stats').innerHTML = `
    <div class="kpi-card">
      <div class="kpi-icon green"><i class="fas fa-users"></i></div>
      <div class="kpi-info">
        <div class="kpi-value">${users.length}</div>
        <div class="kpi-label">Total Users</div>
      </div>
    </div>
    <div class="kpi-card">
      <div class="kpi-icon teal"><i class="fas fa-check-circle"></i></div>
      <div class="kpi-info">
        <div class="kpi-value">${active}</div>
        <div class="kpi-label">Active</div>
      </div>
    </div>
    <div class="kpi-card">
      <div class="kpi-icon blue"><i class="fas fa-shield-alt"></i></div>
      <div class="kpi-info">
        <div class="kpi-value">${inactive}</div>
        <div class="kpi-label">Inactive</div>
      </div>
    </div>
    <div class="kpi-card">
      <div class="kpi-icon amber"><i class="fas fa-user-shield"></i></div>
      <div class="kpi-info">
        <div class="kpi-value">${admins}</div>
        <div class="kpi-label">Administrators</div>
      </div>
    </div>
    <div class="kpi-card">
      <div class="kpi-icon purple"><i class="fas fa-user-tie"></i></div>
      <div class="kpi-info">
        <div class="kpi-value">${managers}</div>
        <div class="kpi-label">Managers</div>
      </div>
    </div>
    <div class="kpi-card">
      <div class="kpi-icon cyan"><i class="fas fa-chart-line"></i></div>
      <div class="kpi-info">
        <div class="kpi-value">${analysts}</div>
        <div class="kpi-label">Analysts</div>
      </div>
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
            <tr style="${u.is_demo ? 'opacity:0.85' : ''}">
              <td class="user-name-cell">
                <i class="fas ${u.is_demo ? 'fa-user-graduate' : 'fa-user'} user-name-icon"></i>
                ${u.username}
                ${u.is_demo ? '<span class="badge badge-warning" style="margin-left:6px;font-size:9px;padding:2px 8px;vertical-align:middle">DEMO</span>' : ''}
              </td>
              <td><span class="role-badge ${ROLE_DISPLAY[u.role]?.class || ''}">${ROLE_DISPLAY[u.role]?.label || u.role}</span></td>
              <td>${u.is_active 
                ? '<span class="status-indicator-user active"><span class="status-dot-user"></span> Active</span>' 
                : '<span class="status-indicator-user inactive"><span class="status-dot-user offline"></span> Inactive</span>'
              }</td>
              <td class="date-cell">${new Date(u.created_at).toLocaleDateString()}</td>
              <td>
                <div class="user-actions">
                  ${u.is_demo ? `
                    <span style="font-size:11px;color:var(--text-muted);padding:0 8px">Demo</span>
                  ` : `
                    <button class="user-action-btn" onclick="showEditUserModal(${u.id})" title="Edit User"><i class="fas fa-edit"></i></button>
                    <button class="user-action-btn" onclick="showPasswordModal(${u.id})" title="Change Password"><i class="fas fa-key"></i></button>
                    <button class="user-action-btn" onclick="toggleUserStatus(${u.id})" title="${u.is_active ? 'Deactivate' : 'Activate'}">
                      ${u.is_active ? '<i class="fas fa-ban" style="color:var(--warning)"></i>' : '<i class="fas fa-check-circle" style="color:var(--success)"></i>'}
                    </button>
                  `}
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
