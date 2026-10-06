const API_BASE_URL = 'http://localhost:3000';

function showMessage(message, type) {
    window.appNotice.show(document.getElementById('mensagem-login'), message, type);
}

const authNotice = sessionStorage.getItem('auth-notice');
sessionStorage.removeItem('auth-notice');
if (authNotice === 'logout') showMessage('Você saiu da sua conta com segurança.', 'success');
if (authNotice === 'expired') showMessage('Sua sessão terminou. Faça login novamente.', 'error');
if (authNotice === 'required') showMessage('Faça login para continuar.', 'error');

async function login(username, password) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);
    try {
        const response = await fetch(`${API_BASE_URL}/login`, {
            method: 'POST',
            mode: 'cors',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password }),
            credentials: 'include',
            signal: controller.signal
        });
        const body = await response.json().catch(() => ({}));
        if (!response.ok) {
            const error = new Error(body.message || `Erro HTTP ${response.status}`);
            error.status = response.status;
            throw error;
        }
        return body;
    } catch (error) {
        if (error.name === 'AbortError') throw new Error('tempo limite excedido');
        if (error instanceof TypeError) throw new Error('Falha na conexão com o servidor');
        throw error;
    } finally {
        clearTimeout(timeout);
    }
}

document.getElementById('loginForm')?.addEventListener('submit', async event => {
    event.preventDefault();
    const button = event.currentTarget.querySelector('button[type="submit"]');
    const originalContent = button.innerHTML;
    const username = document.getElementById('username').value.trim();
    const password = document.getElementById('password').value;

    if (!username || !password) {
        showMessage('Informe o usuário e a senha.', 'error');
        return;
    }

    try {
        button.disabled = true;
        button.innerHTML = '<span class="loading-spinner"></span> Entrando...';
        const response = await login(username, password);
        if (!response.success || !response.user) throw new Error('Não foi possível iniciar a sessão.');

        sessionStorage.setItem('portal-session', 'active');
        sessionStorage.setItem('userData', JSON.stringify(response.user));
        sessionStorage.setItem('auth-notice', 'login');
        showMessage('Login realizado com sucesso. Redirecionando...', 'success');
        window.setTimeout(() => window.location.assign('/FrontEnd/Sistema/sistema.html'), 700);
    } catch (error) {
        const message = error.status === 401
            ? 'Usuário ou senha inválidos.'
            : error.status === 403
                ? error.message
                : error.status === 429
                    ? 'Muitas tentativas. Aguarde alguns minutos antes de tentar novamente.'
                    : error.message === 'tempo limite excedido'
                        ? 'O servidor demorou a responder. Tente novamente.'
                        : error.message === 'Falha na conexão com o servidor'
                            ? 'Não foi possível conectar ao servidor.'
                            : 'Não foi possível entrar agora. Tente novamente em instantes.';
        showMessage(message, 'error');
    } finally {
        button.disabled = false;
        button.innerHTML = originalContent;
    }
});
