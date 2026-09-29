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

    window.appNotice = { show, hide };
})();
