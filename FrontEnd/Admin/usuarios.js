const API_URL = 'http://localhost:3000/api/admin/users';
const roleLabels = { viewer: 'Visualizador', editor: 'Editor', admin: 'Administrador' };
let users = [];

function redirectToLogin() {
    sessionStorage.removeItem('portal-session');
    sessionStorage.removeItem('userData');
    sessionStorage.setItem('auth-notice', 'required');
    window.location.assign('/FrontEnd/login.html');
}

function showStatus(message, kind = 'success') {
    window.appNotice.show(document.getElementById('users-status'), message, kind);
}

async function request(url, options = {}) {
    const response = await fetch(url, { credentials: 'include', ...options });
    const body = await response.json().catch(() => ({}));
    if (response.status === 401) { redirectToLogin(); throw new Error('Sua sessão terminou.'); }
    if (!response.ok) throw new Error(body.message || `HTTP ${response.status}`);
    return body;
}

function renderUsers() {
    const list = document.getElementById('users-list');
    document.getElementById('users-count').textContent = `${users.length} conta${users.length === 1 ? '' : 's'} cadastrada${users.length === 1 ? '' : 's'}.`;
    list.replaceChildren();
    users.forEach(user => {
        const row = document.createElement('tr');
        const role = roleLabels[user.role] || roleLabels.viewer;
        row.innerHTML = `<th scope="row"></th><td></td><td></td><td></td><td><span class="user-role user-role--${user.role || 'viewer'}"></span></td><td><button class="edit-user" type="button">Editar</button></td>`;
        row.cells[0].textContent = user.nome || user.username;
        row.cells[1].textContent = user.username;
        row.cells[2].textContent = user.email;
        row.cells[3].textContent = user.departamento || '—';
        row.querySelector('.user-role').textContent = role;
        row.querySelector('.edit-user').addEventListener('click', () => openEditDialog(user));
        list.append(row);
    });
}

async function loadUsers() {
    const data = await request(API_URL);
    users = Array.isArray(data.users) ? data.users : [];
    renderUsers();
}

function openEditDialog(user) {
    const dialog = document.getElementById('edit-user-dialog');
    const form = document.getElementById('edit-user-form');
    form.elements.id.value = user.id;
    form.elements.nome.value = user.nome || '';
    form.elements.departamento.value = user.departamento || '';
    form.elements.cargo.value = user.cargo || '';
    form.elements.role.value = user.role || 'viewer';
    document.getElementById('edit-user-description').textContent = `${user.username} · ${user.email}`;
    dialog.showModal();
    form.elements.nome.focus();
}

function setupFormHandlers() {
    const createForm = document.getElementById('create-user-form');
    createForm.addEventListener('submit', async event => {
        event.preventDefault();
        const button = createForm.querySelector('button[type="submit"]');
        const original = button.textContent;
        const values = Object.fromEntries(new FormData(createForm).entries());
        if (values.password !== values.confirmPassword) return showStatus('As senhas não coincidem.', 'error');
        try {
            button.disabled = true; button.textContent = 'Criando...';
            const result = await request(API_URL, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(values) });
            createForm.reset();
            showStatus(result.message || 'Conta criada com sucesso.');
            await loadUsers();
        } catch (error) { showStatus(`Não foi possível criar a conta: ${error.message}`, 'error'); }
        finally { button.disabled = false; button.textContent = original; }
    });

    const dialog = document.getElementById('edit-user-dialog');
    const editForm = document.getElementById('edit-user-form');
    dialog.querySelector('.dialog-close').addEventListener('click', () => dialog.close());
    dialog.querySelector('.dialog-cancel').addEventListener('click', () => dialog.close());
    editForm.addEventListener('submit', async event => {
        event.preventDefault();
        const button = editForm.querySelector('button[type="submit"]');
        const original = button.textContent;
        const values = Object.fromEntries(new FormData(editForm).entries());
        try {
            button.disabled = true; button.textContent = 'Salvando...';
            const result = await request(`${API_URL}/${encodeURIComponent(values.id)}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(values) });
            dialog.close();
            showStatus(result.message || 'Dados atualizados.');
            await loadUsers();
        } catch (error) { showStatus(`Não foi possível atualizar a conta: ${error.message}`, 'error'); }
        finally { button.disabled = false; button.textContent = original; }
    });
}

document.addEventListener('DOMContentLoaded', async () => {
    document.getElementById('logout')?.addEventListener('click', () => window.portalAuth?.logout());
    if (!sessionStorage.getItem('portal-session')) return redirectToLogin();
    const date = document.getElementById('current-date');
    if (date) date.textContent = new Date().toLocaleDateString('pt-BR');
    try {
        const session = await request('http://localhost:3000/api/user');
        if (!session.user?.isAdmin) {
            window.location.replace('/FrontEnd/Sistema/sistema.html');
            return;
        }
        document.getElementById('username-display').textContent = session.user.nome || session.user.username;
        setupFormHandlers();
        await loadUsers();
    } catch (error) {
        if (error.message !== 'Sua sessão terminou.') showStatus(`Não foi possível carregar os usuários: ${error.message}`, 'error');
    }
});
