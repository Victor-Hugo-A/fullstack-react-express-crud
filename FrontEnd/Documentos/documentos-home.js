document.addEventListener('DOMContentLoaded', async () => {
    const sidebar = document.getElementById('sidebar');
    const toggle = document.getElementById('menuToggle');
    const backdrop = document.getElementById('menuBackdrop');
    const mobile = window.matchMedia('(max-width: 760px)');

    function setMenuOpen(open) {
        const isOpen = mobile.matches && open;
        document.body.classList.toggle('menu-open', isOpen);
        sidebar.inert = mobile.matches && !isOpen;
        backdrop.hidden = !isOpen;
        toggle.setAttribute('aria-expanded', String(isOpen));
        toggle.setAttribute('aria-label', isOpen ? 'Fechar menu' : 'Abrir menu');
        toggle.textContent = isOpen ? '✕' : '☰';
    }

    setMenuOpen(false);
    toggle.addEventListener('click', () => setMenuOpen(!document.body.classList.contains('menu-open')));
    backdrop.addEventListener('click', () => { setMenuOpen(false); toggle.focus(); });
    document.addEventListener('keydown', event => {
        if (event.key === 'Escape' && document.body.classList.contains('menu-open')) {
            setMenuOpen(false);
            toggle.focus();
        }
    });
    window.addEventListener('resize', () => setMenuOpen(false));

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
    await Promise.allSettled(resources.map(async resource => {
        const badge = document.querySelector(`[data-count-for="${resource}"]`);
        try {
            const data = await apiGet(`/api/${resource}/count`);
            const count = Number(data.count);
            if (!Number.isFinite(count) || count < 0) throw new Error('Contagem inválida');
            badge.textContent = `${new Intl.NumberFormat('pt-BR').format(count)} ${count === 1 ? 'registro' : 'registros'}`;
        } catch (error) {
            badge.textContent = 'Contagem indisponível';
            console.error(`Não foi possível contar ${resource}:`, error);
        }
    }));
});
