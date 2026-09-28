const LOGIN_URL = '/FrontEnd/login.html';

function redirectToLogin() {
    localStorage.removeItem('token');
    localStorage.removeItem('userData');
    window.location.assign(LOGIN_URL);
}

function logout() {
    redirectToLogin();
}

document.addEventListener('DOMContentLoaded', async () => {
    const token = localStorage.getItem('token');
    if (!token) {
        redirectToLogin();
        return;
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
        dateSpan.textContent = new Date().toLocaleDateString('pt-BR');
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
            redirectToLogin();
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
