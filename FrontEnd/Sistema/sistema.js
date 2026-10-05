const LOGIN_URL = '/FrontEnd/login.html';

function redirectToLogin(reason) {
    sessionStorage.removeItem('portal-session');
    sessionStorage.removeItem('userData');
    if (reason) sessionStorage.setItem('auth-notice', reason);
    window.location.assign(LOGIN_URL);
}

function logout() { window.portalAuth?.logout(); }

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
    if (!sessionStorage.getItem('portal-session')) {
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
        const cachedUser = JSON.parse(sessionStorage.getItem('userData'));
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
        const response = await fetch('http://localhost:3000/api/user');
        if (response.status === 401 || response.status === 404) {
            redirectToLogin('expired');
            return;
        }
        if (!response.ok) return;

        const data = await response.json();
        if (usernameDisplay && data.success && data.user) {
            usernameDisplay.textContent = data.user.nome || data.user.username || 'Usuário';
        }
        if (data.success && data.user?.isAdmin) {
            await loadAccountApprovals();
        }
    } catch (error) {
        console.warn('Não foi possível confirmar os dados do usuário.', error);
    }
});

async function loadAccountApprovals() {
    const section = document.getElementById('admin-approvals');
    const list = document.getElementById('admin-approvals-list');
    const count = document.getElementById('admin-approvals-count');
    if (!section || !list || !count) return;
    section.hidden = false;

    try {
        const response = await fetch('http://localhost:3000/api/admin/users/pending');
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const data = await response.json();
        const users = Array.isArray(data.users) ? data.users : [];
        count.textContent = `${users.length} ${users.length === 1 ? 'solicitação pendente' : 'solicitações pendentes'}`;
        list.replaceChildren();

        if (!users.length) {
            const empty = document.createElement('p');
            empty.textContent = 'Não há solicitações de acesso aguardando análise.';
            list.append(empty);
            return;
        }

        users.forEach(user => {
            const card = document.createElement('article');
            card.className = 'approval-card';
            const details = document.createElement('div');
            details.className = 'approval-details';
            const name = document.createElement('strong');
            name.textContent = user.nome || user.username;
            const email = document.createElement('span');
            email.textContent = user.email;
            const created = document.createElement('span');
            created.textContent = `Solicitada em ${new Date(user.created_at).toLocaleDateString('pt-BR')}`;
            details.append(name, email, created);

            const actions = document.createElement('div');
            actions.className = 'approval-actions';
            for (const [action, label] of [['approve', 'Aprovar'], ['reject', 'Rejeitar']]) {
                const button = document.createElement('button');
                button.type = 'button';
                button.dataset.action = action;
                button.textContent = label;
                button.addEventListener('click', async () => {
                    button.disabled = true;
                    try {
                        const result = await fetch(`http://localhost:3000/api/admin/users/${encodeURIComponent(user.id)}/${action}`, {
                            method: 'POST'
                        });
                        const body = await result.json();
                        if (!result.ok) throw new Error(body.message || `HTTP ${result.status}`);
                        window.appNotice.show(
                            document.getElementById('admin-approvals-status'),
                            body.message,
                            'success'
                        );
                        await loadAccountApprovals();
                    } catch (error) {
                        window.appNotice.show(
                            document.getElementById('admin-approvals-status'),
                            `Não foi possível atualizar a solicitação: ${error.message}`,
                            'error'
                        );
                        button.disabled = false;
                    }
                });
                actions.append(button);
            }
            card.append(details, actions);
            list.append(card);
        });
    } catch (error) {
        count.textContent = 'Não foi possível carregar as solicitações.';
        window.appNotice.show(
            document.getElementById('admin-approvals-status'),
            `Erro ao carregar solicitações: ${error.message}`,
            'error'
        );
    }
}
