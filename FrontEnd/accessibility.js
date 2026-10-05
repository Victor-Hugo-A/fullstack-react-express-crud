(() => {
    const focusableSelector = [
        'a[href]',
        'button:not([disabled])',
        'input:not([disabled])',
        'select:not([disabled])',
        'textarea:not([disabled])',
        '[tabindex]:not([tabindex="-1"])'
    ].join(', ');

    function activeDialog() {
        return [...document.querySelectorAll('[role="dialog"][aria-modal="true"]')]
            .filter(dialog => !dialog.hidden && dialog.getClientRects().length > 0)
            .at(-1);
    }

    document.addEventListener('keydown', event => {
        if (event.key !== 'Tab' || event.defaultPrevented) return;
        const dialog = activeDialog();
        if (!dialog) return;

        const focusable = [...dialog.querySelectorAll(focusableSelector)]
            .filter(element => !element.hidden && element.getClientRects().length > 0);

        if (focusable.length === 0) {
            event.preventDefault();
            dialog.focus();
            return;
        }

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
})();
