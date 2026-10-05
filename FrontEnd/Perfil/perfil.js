const API_URL = 'http://localhost:3000';

function logout(reason = 'logout') {
    if (window.portalAuth?.logout) return window.portalAuth.logout(reason);
    sessionStorage.removeItem('portal-session');
    sessionStorage.removeItem('userData');
    sessionStorage.setItem('auth-notice', reason);
    window.location.assign('/FrontEnd/login.html');
}

function showFeedback(message, type) {
    window.appNotice.show(document.getElementById('mensagem-login'), message, type);
}

async function request(path, method, token, body) {
    const options = { method, headers: { Authorization: `Bearer ${token}` } };
    if (body !== undefined) { options.headers['Content-Type'] = 'application/json'; options.body = JSON.stringify(body); }
    const response = await fetch(`${API_URL}${path}`, options);
    if (response.status === 401) {
        if (path !== '/change-password' || response.status === 403) { logout('expired'); return null; }
    }
    const data = await response.json();
    if (!response.ok || !data.success) throw new Error(data.message || 'Não foi possível salvar as alterações.');
    return data;
}

document.addEventListener('DOMContentLoaded', async () => {
    document.getElementById('logout')?.addEventListener('click', () => logout());
    const token = sessionStorage.getItem('portal-session');
    if (!token) { logout('expired'); return; }
    const form = document.getElementById('perfil-form');
    const saveStatus = document.getElementById('profile-save-status');
    let usuario = null;

    function setFieldValues(user) {
        usuario = user;
        ['nome', 'email', 'cpf', 'departamento', 'cargo'].forEach(field => { document.getElementById(field).value = user[field] || ''; });
        const name = user.nome || user.username || 'Usuário';
        document.getElementById('username-display').textContent = name;
        document.getElementById('profile-overview-title').textContent = name;
        document.getElementById('profile-email').textContent = user.email || 'E-mail não informado';
        document.getElementById('profile-role').textContent = user.cargo || 'Cargo não informado';
        document.getElementById('profile-department').textContent = user.departamento || 'Departamento não informado';
        document.getElementById('profile-avatar').textContent = name.trim().split(/\s+/).slice(0, 2).map(part => part[0]).join('').toUpperCase() || 'U';
    }

    function updatePasswordStrength() {
        const password = document.getElementById('senha').value;
        const text = document.getElementById('password-strength');
        text.className = 'password-strength';
        if (!password) { text.textContent = 'Use ao menos 8 caracteres.'; return; }
        if (password.length < 8) { text.textContent = 'A senha precisa ter ao menos 8 caracteres.'; text.classList.add('password-strength--weak'); return; }
        const varied = /[A-Z]/.test(password) && /[a-z]/.test(password) && /\d/.test(password);
        text.textContent = varied ? 'Senha forte.' : 'Use letras maiúsculas, minúsculas e números para maior segurança.';
        text.classList.add(varied ? 'password-strength--good' : 'password-strength--weak');
    }

    try {
        const profile = await request('/api/user', 'GET', token);
        if (!profile) return;
        setFieldValues(profile.user);
        sessionStorage.setItem('userData', JSON.stringify(profile.user));
    } catch (error) {
        try { const cached = JSON.parse(sessionStorage.getItem('userData')); if (cached) setFieldValues(cached); else throw error; }
        catch { showFeedback('Não foi possível carregar os dados atualizados do perfil.', 'warning'); }
    }
    const now = new Date();
    const date = document.getElementById('current-date');
    date.textContent = now.toLocaleDateString('pt-BR');
    date.dateTime = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;

    document.querySelectorAll('.password-toggle').forEach(button => button.addEventListener('click', () => {
        const input = button.parentElement.querySelector('input');
        const visible = input.type === 'text'; input.type = visible ? 'password' : 'text';
        button.textContent = visible ? 'Mostrar' : 'Ocultar'; button.setAttribute('aria-pressed', String(!visible));
        button.setAttribute('aria-label', `${visible ? 'Mostrar' : 'Ocultar'} ${input.labels[0].textContent.toLowerCase()}`);
    }));
    document.getElementById('senha').addEventListener('input', updatePasswordStrength);
    ['departamento', 'cargo'].forEach(id => document.getElementById(id).addEventListener('input', () => { saveStatus.textContent = 'Alterações não salvas'; }));

    form.addEventListener('submit', async event => {
        event.preventDefault();
        const currentPassword = document.getElementById('senha-atual').value;
        const newPassword = document.getElementById('senha').value;
        const confirmNewPassword = document.getElementById('confirmar-senha').value;
        const changePassword = Boolean(currentPassword || newPassword || confirmNewPassword);
        const submitButton = form.querySelector('button[type="submit"]');
        if (changePassword) {
            if (!currentPassword || !newPassword || !confirmNewPassword) return showFeedback('Preencha os três campos de senha para alterá-la.', 'error');
            if (newPassword === currentPassword) return showFeedback('A nova senha deve ser diferente da atual.', 'error');
            if (newPassword.length < 8 || newPassword !== confirmNewPassword) return showFeedback('A nova senha deve ter ao menos 8 caracteres e coincidir com a confirmação.', 'error');
        }
        submitButton.disabled = true; saveStatus.textContent = 'Salvando...'; let passwordUpdated = false;
        try {
            if (changePassword) { const passwordResult = await request('/change-password', 'POST', token, { currentPassword, newPassword, confirmNewPassword }); if (!passwordResult) return; passwordUpdated = true; }
            const result = await request('/update-profile', 'PUT', token, { departamento: document.getElementById('departamento').value.trim(), cargo: document.getElementById('cargo').value.trim(), cpf: usuario?.cpf || document.getElementById('cpf').value });
            if (!result) return;
            setFieldValues(result.user); sessionStorage.setItem('userData', JSON.stringify(result.user)); form.querySelectorAll('input[type="password"]').forEach(input => { input.value = ''; }); updatePasswordStrength(); saveStatus.textContent = 'Alterações salvas agora';
            showFeedback(changePassword ? 'Perfil e senha atualizados com sucesso.' : 'Perfil atualizado com sucesso.', 'success');
        } catch (error) {
            const reason = error instanceof TypeError ? 'Não foi possível conectar ao servidor.' : error.message;
            saveStatus.textContent = 'Não foi possível salvar as alterações'; showFeedback(passwordUpdated ? `Senha alterada, mas o perfil não foi salvo: ${reason}` : reason, 'error');
        } finally { submitButton.disabled = false; }
    });
});
