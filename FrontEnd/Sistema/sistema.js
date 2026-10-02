const LOGIN_URL = '/FrontEnd/login.html';

function redirectToLogin(reason) {
    localStorage.removeItem('token');
    localStorage.removeItem('userData');
    if (reason) sessionStorage.setItem('auth-notice', reason);
    window.location.assign(LOGIN_URL);
}

function logout() {
    redirectToLogin('logout');
}

document.addEventListener('DOMContentLoaded', async () => {
    document.getElementById('logout')?.addEventListener('click', logout);
    const documentsDropdown = document.querySelector('.nav-dropdown');
    const documentsToggle = documentsDropdown?.querySelector('.nav-dropdown-toggle');
    if (documentsDropdown && documentsToggle) {
        const setDocumentsMenu = open => {
            documentsDropdown.classList.toggle('is-open', open);
            documentsToggle.setAttribute('aria-expanded', String(open));
            documentsToggle.setAttribute('aria-label', open ? 'Fechar opções de documentos' : 'Abrir opções de documentos');
        };
        documentsToggle.addEventListener('click', event => {
            event.preventDefault();
            setDocumentsMenu(!documentsDropdown.classList.contains('is-open'));
        });
        document.addEventListener('click', event => { if (!documentsDropdown.contains(event.target)) setDocumentsMenu(false); });
        document.addEventListener('keydown', event => { if (event.key === 'Escape') { setDocumentsMenu(false); documentsToggle.focus(); } });
    }
    const token = localStorage.getItem('token');
    if (!token) {
        redirectToLogin();
        return;
    }

    const authNotice = sessionStorage.getItem('auth-notice');
    sessionStorage.removeItem('auth-notice');
    if (authNotice === 'login') {
        const feedback = document.getElementById('session-feedback');
        window.appNotice.show(feedback, 'Acesso realizado com sucesso.', 'success');
    }

    const usernameDisplay = document.getElementById('username-display');
    try {
        const cachedUser = JSON.parse(localStorage.getItem('userData'));
        if (usernameDisplay && cachedUser) {
            usernameDisplay.textContent = cachedUser.nome || cachedUser.username || 'Usuário';
        }
    } catch {
        // O nome será obtido da API abaixo.
    }

    const dateSpan = document.getElementById('current-date');
    if (dateSpan) {
        const today = new Date();
        dateSpan.textContent = today.toLocaleDateString('pt-BR');
        dateSpan.dateTime = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
    }

    const backToTop = document.querySelector('.back-to-top');
    if (backToTop) {
        const updateBackToTop = () => {
            backToTop.classList.toggle('visible', window.scrollY > 300);
        };
        window.addEventListener('scroll', updateBackToTop, { passive: true });
        updateBackToTop();
    }

    try {
        const response = await fetch('http://localhost:3000/api/user', {
            headers: { Authorization: `Bearer ${token}` }
        });
        if (response.status === 401 || response.status === 403 || response.status === 404) {
            redirectToLogin('expired');
            return;
        }
        if (!response.ok) return;

        const data = await response.json();
        if (usernameDisplay && data.success && data.user) {
            usernameDisplay.textContent = data.user.nome || data.user.username || 'Usuário';
        }
    } catch (error) {
        console.warn('Não foi possível confirmar os dados do usuário.', error);
    }
});
