document.addEventListener('DOMContentLoaded', async () => {
    if (!sessionStorage.getItem('portal-session')) {
        sessionStorage.setItem('auth-notice', 'required');
        window.location.replace('/FrontEnd/login.html');
        return;
    }

    document.getElementById('logout')?.addEventListener('click', () => window.portalAuth?.logout());

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
        document.addEventListener('click', event => {
            if (!documentsDropdown.contains(event.target)) setDocumentsMenu(false);
        });
        document.addEventListener('keydown', event => {
            if (event.key === 'Escape') {
                setDocumentsMenu(false);
                documentsToggle.focus();
            }
        });
    }

    const date = document.getElementById('current-date');
    if (date) {
        const now = new Date();
        date.textContent = now.toLocaleDateString('pt-BR');
        date.dateTime = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    }

    const username = document.getElementById('username-display');
    if (!username) return;
    try {
        const cached = JSON.parse(sessionStorage.getItem('userData'));
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
