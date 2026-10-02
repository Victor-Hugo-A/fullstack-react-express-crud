(() => {
    const paths = {
        menu: '<path d="M4 7h16M4 12h16M4 17h16"/>',
        close: '<path d="M5 5l14 14M19 5 5 19"/>',
        documents: '<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M7 9h10M7 13h10M7 17h6"/>',
        contracts: '<path d="M7 3h8l4 4v14H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2Z"/><path d="M15 3v5h5M9 12h6M9 16h6"/>',
        projects: '<rect x="3" y="7" width="18" height="14" rx="2"/><path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M3 12h18M10 12v2h4v-2"/>',
        identities: '<rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="9" cy="10" r="2"/><path d="M6 16a3 3 0 0 1 6 0M15 9h3M15 13h3"/>',
        charts: '<path d="M4 20V4M4 20h16M8 16v-4M13 16V8M18 16V5"/>',
        dashboard: '<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>',
        analysis: '<path d="M4 20V4M4 20h16M7 15l4-4 3 2 5-6"/>',
        profile: '<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>',
        chevron: '<path d="m6 9 6 6 6-6"/>',
        home: '<path d="m3 10 9-7 9 7v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V10Z"/><path d="M9 21v-7h6v7"/>',
        upload: '<path d="M12 16V4m-4 4 4-4 4 4M4 16v3a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-3"/>',
        list: '<path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01"/>',
        plus: '<path d="M12 5v14M5 12h14"/>',
        save: '<path d="M4 3h14l3 3v15H3V4a1 1 0 0 1 1-1Z"/><path d="M7 3v6h10V3M7 21v-8h10v8"/>',
        reset: '<path d="M3 12a9 9 0 1 0 3-6.7L3 8"/><path d="M3 3v5h5"/>',
        search: '<circle cx="11" cy="11" r="7"/><path d="m16 16 5 5"/>',
        eye: '<path d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6S2 12 2 12Z"/><circle cx="12" cy="12" r="2.5"/>',
        download: '<path d="M12 3v12m-4-4 4 4 4-4M4 17v3a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-3"/>',
        trash: '<path d="M4 7h16M9 7V4h6v3M6 7l1 14h10l1-14M10 11v6M14 11v6"/>',
        edit: '<path d="M12 20h9M4 16l-1 5 5-1L20 8l-4-4L4 16Z"/>',
        calendar: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M7 3v4M17 3v4M3 10h18"/>',
        file: '<path d="M7 3h8l4 4v14H5V5a2 2 0 0 1 2-2Z"/><path d="M15 3v5h4M8 13h8M8 17h6"/>',
        image: '<rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8" cy="8" r="1.5"/><path d="m3 17 5-5 4 4 3-3 6 6"/>',
        info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 8h.01"/>',
        loading: '<path d="M12 3a9 9 0 1 1-9 9"/>'
    };

    function markup(name, className = 'ui-icon') {
        return `<svg xmlns="http://www.w3.org/2000/svg" class="${className}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths[name] || paths.file}</svg>`;
    }

    function icon(name, className = 'nav-icon') {
        const holder = document.createElement('span');
        holder.innerHTML = markup(name, className);
        return holder.firstElementChild;
    }

    window.documentIcons = {
        markup,
        dataUri: name => `data:image/svg+xml,${encodeURIComponent(markup(name).replace('stroke="currentColor"', 'stroke="#4c7897"'))}`
    };

    function init() {
        const sidebar = document.getElementById('sidebar');
        const toggle = document.getElementById('menuToggle');
        const documentsToggle = document.getElementById('documentosToggle');
        const submenu = document.getElementById('submenuDocumentos');
        if (!sidebar || !toggle) return;
        sidebar.querySelectorAll('.other-label, a[href="/FrontEnd/Dashboard/dashboard.html"], a[href="/FrontEnd/Análises/analises.html"], a[href="/FrontEnd/Perfil/perfil.html"]').forEach(link => link.remove());
        document.querySelectorAll('[data-icon]').forEach(holder => {
            holder.replaceChildren(icon(holder.dataset.icon, 'ui-icon'));
        });

        const iconsByPage = {
            'documentos.html': 'documents', 'contrato.html': 'contracts', 'projetos.html': 'projects',
            'identidades.html': 'identities', 'graficos.html': 'charts',
            'dashboard.html': 'dashboard', 'analises.html': 'analysis',
            'perfil.html': 'profile'
        };
        const currentPage = window.location.pathname.split('/').pop();
        sidebar.querySelectorAll('.nav-link').forEach(link => {
            const page = link.getAttribute('href')?.split('/').pop();
            const name = link === documentsToggle ? 'documents' : iconsByPage[page];
            if (name) {
                const oldIcon = link.querySelector('.icon');
                if (oldIcon) oldIcon.replaceWith(icon(name));
            }
            const active = page === currentPage;
            link.closest('.nav-item')?.classList.toggle('active', active);
            if (active) link.setAttribute('aria-current', 'page');
            else link.removeAttribute('aria-current');
        });

        if (documentsToggle && submenu) {
            const arrow = documentsToggle.querySelector('.submenu-arrow');
            arrow?.replaceWith(icon('chevron', 'submenu-arrow rotated'));
            submenu.style.removeProperty('display');
            documentsToggle.addEventListener('click', event => {
                event.preventDefault();
                submenu.hidden = !submenu.hidden;
                documentsToggle.setAttribute('aria-expanded', String(!submenu.hidden));
                documentsToggle.querySelector('.submenu-arrow')?.classList.toggle('rotated', !submenu.hidden);
            });
        }

        const backdrop = document.createElement('div');
        backdrop.className = 'document-menu-backdrop';
        backdrop.hidden = true;
        document.body.append(backdrop);
        const mobile = window.matchMedia('(max-width: 768px)');

        function setOpen(open) {
            sidebar.classList.toggle('closed', !open);
            sidebar.inert = !open;
            document.body.classList.toggle('document-menu-collapsed', !open);
            document.body.classList.toggle('document-menu-mobile-open', mobile.matches && open);
            backdrop.hidden = !(mobile.matches && open);
            toggle.replaceChildren(icon(open ? 'close' : 'menu', 'menu-glyph'));
            toggle.setAttribute('aria-expanded', String(open));
            toggle.setAttribute('aria-label', open ? 'Fechar menu' : 'Abrir menu');
        }

        setOpen(!mobile.matches);
        toggle.addEventListener('click', () => {
            const open = sidebar.classList.contains('closed');
            setOpen(open);
            if (open && mobile.matches) sidebar.querySelector('a[href]')?.focus();
        });
        backdrop.addEventListener('click', () => { setOpen(false); toggle.focus(); });
        document.addEventListener('keydown', event => {
            const isOpen = !sidebar.classList.contains('closed');
            if (event.key === 'Escape' && isOpen) {
                setOpen(false);
                toggle.focus();
                return;
            }
            if (event.key !== 'Tab' || !mobile.matches || !isOpen) return;
            const focusable = [
                ...sidebar.querySelectorAll('a[href], button:not([disabled]), [tabindex="0"]'),
                toggle
            ].filter(element => !element.inert && element.getClientRects().length > 0);
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
        sidebar.addEventListener('click', event => {
            if (mobile.matches && event.target.closest('a.nav-link:not(#documentosToggle)')) setOpen(false);
        });
        mobile.addEventListener('change', () => setOpen(!mobile.matches));
    }

    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
    else init();
})();
