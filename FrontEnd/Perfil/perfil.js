const API_URL = 'http://localhost:3000';

function logout(reason = 'logout') {
    localStorage.removeItem('token');
    localStorage.removeItem('userData');
    sessionStorage.setItem('auth-notice', reason);
    window.location.assign('/FrontEnd/login.html');
}

function showFeedback(message, type) {
    const feedback = document.getElementById('mensagem-login');
    feedback.textContent = message;
    feedback.className = `form-feedback ${type}`;
    feedback.hidden = false;
}

async function request(path, method, token, body) {
    const response = await fetch(`${API_URL}${path}`, {
        method,
        headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(body)
    });

    if (response.status === 401 || response.status === 403) {
        // Uma senha atual incorreta também retorna 401; nesse caso, a sessão segue válida.
        if (path !== '/change-password' || response.status === 403) {
            logout('expired');
            return null;
        }
    }

    const data = await response.json();
    if (!response.ok || !data.success) {
        throw new Error(data.message || 'Não foi possível salvar as alterações.');
    }
    return data;
}

document.addEventListener('DOMContentLoaded', () => {
    const token = localStorage.getItem('token');
    let usuario;
    try {
        usuario = JSON.parse(localStorage.getItem('userData'));
    } catch {
        usuario = null;
    }
    if (!token || !usuario) {
        logout('expired');
        return;
    }

    for (const field of ['nome', 'email', 'cpf', 'departamento', 'cargo']) {
        document.getElementById(field).value = usuario[field] || '';
    }
    document.getElementById('username-display').textContent = usuario.nome || usuario.username || 'Usuário';
    document.getElementById('current-date').textContent = new Date().toLocaleDateString('pt-BR');

    const form = document.getElementById('perfil-form');
    form.addEventListener('submit', async (event) => {
        event.preventDefault();
        const currentPassword = document.getElementById('senha-atual').value;
        const newPassword = document.getElementById('senha').value;
        const confirmNewPassword = document.getElementById('confirmar-senha').value;
        const changePassword = Boolean(currentPassword || newPassword || confirmNewPassword);
        const submitButton = form.querySelector('button[type="submit"]');

        if (changePassword) {
            if (!currentPassword || !newPassword || !confirmNewPassword) {
                showFeedback('Preencha os três campos de senha para alterá-la.', 'error');
                return;
            }
            if (newPassword === currentPassword) {
                showFeedback('A nova senha deve ser diferente da atual.', 'error');
                return;
            }
            if (newPassword.length < 8 || newPassword !== confirmNewPassword) {
                showFeedback('A nova senha deve ter ao menos 8 caracteres e coincidir com a confirmação.', 'error');
                return;
            }
        }

        submitButton.disabled = true;
        let passwordUpdated = false;
        try {
            if (changePassword) {
                await request('/change-password', 'POST', token, {
                    currentPassword, newPassword, confirmNewPassword
                });
                passwordUpdated = true;
            }

            const result = await request('/update-profile', 'PUT', token, {
                departamento: document.getElementById('departamento').value.trim(),
                cargo: document.getElementById('cargo').value.trim(),
                cpf: document.getElementById('cpf').value
            });
            if (!result) return;

            localStorage.setItem('userData', JSON.stringify(result.user));
            usuario = result.user;
            form.querySelectorAll('input[type="password"]').forEach(input => { input.value = ''; });
            showFeedback(changePassword ? 'Perfil e senha atualizados com sucesso.' : 'Perfil atualizado com sucesso.', 'success');
        } catch (error) {
            const reason = error instanceof TypeError ? 'Não foi possível conectar ao servidor.' : error.message;
            showFeedback(passwordUpdated ? `Senha alterada, mas o perfil não foi salvo: ${reason}` : reason, 'error');
        } finally {
            submitButton.disabled = false;
        }
    });
});
