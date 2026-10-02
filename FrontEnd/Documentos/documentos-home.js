document.addEventListener('DOMContentLoaded', async () => {
    const icons = {
        menu: '<path d="M4 7h16M4 12h16M4 17h16"/>', close: '<path d="M5 5l14 14M19 5 5 19"/>',
        documents: '<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M7 9h10M7 13h10M7 17h6"/>',
        contracts: '<path d="M7 3h8l4 4v14H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2Z"/><path d="M15 3v5h5M9 12h6M9 16h6"/>',
        projects: '<rect x="3" y="7" width="18" height="14" rx="2"/><path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M3 12h18M10 12v2h4v-2"/>',
        identities: '<rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="9" cy="10" r="2"/><path d="M6 16a3 3 0 0 1 6 0M15 9h3M15 13h3"/>',
        charts: '<path d="M4 20V4M4 20h16M8 16v-4M13 16V8M18 16V5"/>',
        dashboard: '<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>',
        analysis: '<path d="M4 20V4M4 20h16M7 15l4-4 3 2 5-6"/>', profile: '<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>'
    };
    const icon = name => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${icons[name] || icons.documents}</svg>`;
    document.querySelectorAll('[data-icon]').forEach(holder => { holder.innerHTML = icon(holder.dataset.icon); });

    const sidebar = document.getElementById('sidebar');
    const toggle = document.getElementById('menuToggle');
    const backdrop = document.getElementById('menuBackdrop');
    const mobile = window.matchMedia('(max-width: 768px)');
    function setMenuOpen(open) {
        const mobileOpen = mobile.matches && open;
        document.body.classList.toggle('menu-open', mobileOpen);
        document.body.classList.toggle('menu-collapsed', !open);
        sidebar.inert = !open;
        backdrop.hidden = !mobileOpen;
        toggle.setAttribute('aria-expanded', String(open));
        toggle.setAttribute('aria-label', open ? 'Fechar menu' : 'Abrir menu');
        toggle.innerHTML = icon(open ? 'close' : 'menu');
    }
    setMenuOpen(!mobile.matches);
    toggle.addEventListener('click', () => {
        const open = sidebar.inert;
        setMenuOpen(open);
        if (open && mobile.matches) sidebar.querySelector('a[href]')?.focus();
    });
    backdrop.addEventListener('click', () => { setMenuOpen(false); toggle.focus(); });
    document.addEventListener('keydown', event => {
        if (event.key === 'Escape' && !sidebar.inert) {
            setMenuOpen(false);
            toggle.focus();
            return;
        }
        if (event.key !== 'Tab' || !mobile.matches || sidebar.inert) return;
        const focusable = [...sidebar.querySelectorAll('a[href], button:not([disabled]), [tabindex="0"]'), toggle]
            .filter(element => !element.inert && element.getClientRects().length > 0);
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (event.shiftKey && document.activeElement === first) {
            event.preventDefault();
            last.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
            event.preventDefault();
            first.focus();
        }
    });
    mobile.addEventListener('change', () => setMenuOpen(!mobile.matches));

    if (!localStorage.getItem('token')) { window.location.replace('/FrontEnd/login.html'); return; }
    try {
        const result = await apiGet('/api/user');
        if (!result.success || !result.user) throw new Error('Usuário não encontrado');
        document.getElementById('username-display').textContent = result.user.nome || result.user.username;
    } catch (error) { console.error('Não foi possível carregar o usuário:', error); if (!localStorage.getItem('token')) return; }

    const resources = ['contracts', 'projects', 'identities'];
    let unavailableCounts = 0;
    await Promise.allSettled(resources.map(async resource => {
        const badge = document.querySelector(`[data-count-for="${resource}"]`);
        try {
            const data = await apiGet(`/api/${resource}/count`);
            const count = Number(data.count);
            if (!Number.isFinite(count) || count < 0) throw new Error('Contagem inválida');
            badge.textContent = `${new Intl.NumberFormat('pt-BR').format(count)} ${count === 1 ? 'registro' : 'registros'}`;
        } catch (error) { badge.textContent = 'Contagem indisponível'; unavailableCounts += 1; console.error(`Não foi possível contar ${resource}:`, error); }
    }));
    if (unavailableCounts > 0 && localStorage.getItem('token')) { const notice = document.createElement('p'); document.body.appendChild(notice); window.appNotice.show(notice, 'Não foi possível atualizar todas as contagens de documentos.', 'warning'); }
});
