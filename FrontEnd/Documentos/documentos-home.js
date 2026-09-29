document.addEventListener('DOMContentLoaded', async () => {
    const sidebar = document.getElementById('sidebar');
    const toggle = document.getElementById('menuToggle');
    const backdrop = document.getElementById('menuBackdrop');
    const mobile = window.matchMedia('(max-width: 760px)');

    function setMenuOpen(open) {
        const isMobileOpen = mobile.matches && open;
        document.body.classList.toggle('menu-open', isMobileOpen);
        document.body.classList.toggle('menu-collapsed', !open);
        sidebar.inert = !open;
        backdrop.hidden = !isMobileOpen;
        toggle.setAttribute('aria-expanded', String(open));
        toggle.setAttribute('aria-label', open ? 'Fechar menu' : 'Abrir menu');
        toggle.textContent = open ? '✕' : '☰';
    }

    setMenuOpen(!mobile.matches);
    toggle.addEventListener('click', () => setMenuOpen(sidebar.inert));
    backdrop.addEventListener('click', () => { setMenuOpen(false); toggle.focus(); });
    document.addEventListener('keydown', event => {
        if (event.key === 'Escape' && !sidebar.inert) {
            setMenuOpen(false);
            toggle.focus();
        }
    });
    mobile.addEventListener('change', () => setMenuOpen(!mobile.matches));

    if (!localStorage.getItem('token')) {
        window.location.replace('/FrontEnd/login.html');
        return;
    }

    try {
        const result = await apiGet('/api/user');
        if (!result.success || !result.user) throw new Error('Usuário não encontrado');
        document.getElementById('username-display').textContent = result.user.nome || result.user.username;
    } catch (error) {
        console.error('Não foi possível carregar o usuário:', error);
        if (!localStorage.getItem('token')) return;
    }

    const resources = ['contracts', 'projects', 'identities'];
    let unavailableCounts = 0;
    await Promise.allSettled(resources.map(async resource => {
        const badge = document.querySelector(`[data-count-for="${resource}"]`);
        try {
            const data = await apiGet(`/api/${resource}/count`);
            const count = Number(data.count);
            if (!Number.isFinite(count) || count < 0) throw new Error('Contagem inválida');
            badge.textContent = `${new Intl.NumberFormat('pt-BR').format(count)} ${count === 1 ? 'registro' : 'registros'}`;
        } catch (error) {
            badge.textContent = 'Contagem indisponível';
            unavailableCounts += 1;
            console.error(`Não foi possível contar ${resource}:`, error);
        }
    }));
    if (unavailableCounts > 0 && localStorage.getItem('token')) {
        const notice = document.createElement('p');
        document.body.appendChild(notice);
        window.appNotice.show(notice, 'Não foi possível atualizar todas as contagens de documentos.', 'warning');
    }
});
