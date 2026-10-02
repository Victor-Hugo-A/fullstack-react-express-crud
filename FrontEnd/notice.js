(() => {
    const timers = new WeakMap();
    const types = ['success', 'error', 'warning', 'info'];

    function hide(element) {
        if (!element) return;
        clearTimeout(timers.get(element));
        timers.delete(element);
        element.hidden = true;
        element.style.display = 'none';
    }

    function show(element, message, type = 'info') {
        if (!element) return;
        if (!message) return hide(element);
        clearTimeout(timers.get(element));
        const kind = types.includes(type) ? type : 'info';
        element.textContent = message;
        element.classList.add('app-notice');
        types.forEach(value => element.classList.toggle(value, value === kind));
        element.setAttribute('role', kind === 'error' || kind === 'warning' ? 'alert' : 'status');
        element.hidden = false;
        element.style.display = 'block';
        timers.set(element, setTimeout(() => hide(element), 4000));
    }

    function readCookie(name) {
        const prefix = `${encodeURIComponent(name)}=`;
        return document.cookie.split('; ').find(item => item.startsWith(prefix))?.slice(prefix.length) || '';
    }

    const nativeFetch = window.fetch.bind(window);
    window.fetch = (input, init = {}) => {
        const url = new URL(typeof input === 'string' ? input : input.url, window.location.href);
        if (url.origin !== 'http://localhost:3000') return nativeFetch(input, init);
        const headers = new Headers(init.headers || (input instanceof Request ? input.headers : undefined));
        headers.delete('Authorization');
        const method = String(init.method || (input instanceof Request ? input.method : 'GET')).toUpperCase();
        if (!['GET', 'HEAD', 'OPTIONS'].includes(method)) {
            const csrfToken = decodeURIComponent(readCookie('senappen_csrf'));
            if (csrfToken) headers.set('X-CSRF-Token', csrfToken);
        }
        return nativeFetch(input, { ...init, headers, credentials: 'include' });
    };

    async function logout(reason = 'logout') {
        try { await window.fetch('http://localhost:3000/api/logout', { method: 'POST' }); } catch { /* A limpeza local ainda deve ocorrer. */ }
        sessionStorage.removeItem('portal-session');
        sessionStorage.removeItem('userData');
        sessionStorage.setItem('auth-notice', reason);
        window.location.assign('/FrontEnd/login.html');
    }

    window.portalAuth = { logout };
    window.appNotice = { show, hide };
})();
