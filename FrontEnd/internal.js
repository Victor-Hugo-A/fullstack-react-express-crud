document.addEventListener('DOMContentLoaded', async () => {
    const token = localStorage.getItem('token');
    if (!token) {
        sessionStorage.setItem('auth-notice', 'required');
        window.location.replace('/FrontEnd/login.html');
        return;
    }

    document.getElementById('logout')?.addEventListener('click', () => {
        localStorage.removeItem('token');
        localStorage.removeItem('userData');
        sessionStorage.setItem('auth-notice', 'logout');
        window.location.assign('/FrontEnd/login.html');
    });

    const date = document.getElementById('current-date');
    if (date) {
        const now = new Date();
        date.textContent = now.toLocaleDateString('pt-BR');
        date.dateTime = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    }

    const username = document.getElementById('username-display');
    if (!username) return;
    try {
        const cached = JSON.parse(localStorage.getItem('userData'));
        username.textContent = cached?.nome || cached?.username || 'Usuário';
    } catch {
        username.textContent = 'Usuário';
    }

    try {
        const data = await window.apiGet('/api/user');
        username.textContent = data.user?.nome || data.user?.username || username.textContent;
    } catch {
        // A navegação permanece disponível enquanto a sessão é verificada.
    }
});
