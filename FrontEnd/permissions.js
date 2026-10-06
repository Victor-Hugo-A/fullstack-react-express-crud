(function () {
    const writeSelectors = '#document-form, #project-form, #identity-form, .btn-edit, .btn-delete, .btn-delete-file';

    async function applyPermissions() {
        if (!sessionStorage.getItem('portal-session')) return;
        try {
            const response = await fetch('http://localhost:3000/api/user', { credentials: 'include' });
            if (!response.ok) return;
            const data = await response.json();
            const role = data.user?.role || 'viewer';
            document.body.dataset.role = role;
            window.portalPermissions = { role, canWrite: role === 'editor' || role === 'admin', isAdmin: role === 'admin' };
            if (role === 'viewer') {
                document.querySelectorAll(writeSelectors).forEach(element => { element.hidden = true; });
                document.querySelectorAll('#document-form, #project-form, #identity-form').forEach(form => {
                    const section = form.closest('section');
                    if (section) section.hidden = true;
                });
                const main = document.querySelector('main');
                if (main && !document.getElementById('read-only-notice')) {
                    const notice = document.createElement('p');
                    notice.id = 'read-only-notice';
                    notice.className = 'permission-notice';
                    notice.textContent = 'Seu perfil permite consultar os registros. Para incluir ou editar dados, solicite acesso de Editor a um administrador.';
                    main.prepend(notice);
                }
            }
        } catch {
            // As rotas do servidor continuam sendo a proteção definitiva.
        }
    }

    document.addEventListener('DOMContentLoaded', applyPermissions);
}());
