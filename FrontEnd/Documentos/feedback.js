(() => {
    function show(element, message, type = 'info') {
        window.appNotice.show(element, message, type);
    }

    function confirm({
        title = 'Confirmar ação',
        message,
        confirmLabel = 'Confirmar',
        cancelLabel = 'Cancelar'
    } = {}) {
        return new Promise(resolve => {
            const dialog = document.createElement('dialog');
            dialog.className = 'portal-confirm-dialog';
            dialog.setAttribute('aria-labelledby', 'portal-confirm-title');
            dialog.setAttribute('aria-describedby', 'portal-confirm-message');

            const content = document.createElement('div');
            content.className = 'portal-confirm-content';
            const accent = document.createElement('span');
            accent.className = 'portal-confirm-accent';
            accent.setAttribute('aria-hidden', 'true');
            const heading = document.createElement('h2');
            heading.id = 'portal-confirm-title';
            heading.textContent = title;
            const description = document.createElement('p');
            description.id = 'portal-confirm-message';
            description.textContent = message || 'Deseja continuar com esta ação?';
            const actions = document.createElement('div');
            actions.className = 'portal-confirm-actions';
            const cancel = document.createElement('button');
            cancel.type = 'button';
            cancel.className = 'portal-confirm-cancel';
            cancel.textContent = cancelLabel;
            const accept = document.createElement('button');
            accept.type = 'button';
            accept.className = 'portal-confirm-accept';
            accept.textContent = confirmLabel;

            actions.append(cancel, accept);
            content.append(accent, heading, description, actions);
            dialog.append(content);

            const previousFocus = document.activeElement;
            let settled = false;
            const finish = accepted => {
                if (settled) return;
                settled = true;
                dialog.close();
                dialog.remove();
                if (previousFocus instanceof HTMLElement && previousFocus.isConnected) previousFocus.focus();
                resolve(accepted);
            };

            cancel.addEventListener('click', () => finish(false));
            accept.addEventListener('click', () => finish(true));
            dialog.addEventListener('cancel', event => {
                event.preventDefault();
                finish(false);
            });
            dialog.addEventListener('click', event => {
                if (event.target === dialog) finish(false);
            });

            document.body.append(dialog);
            dialog.showModal();
            cancel.focus();
        });
    }

    async function requestError(response, fallback = 'Não foi possível concluir a operação.') {
        const data = await response.json().catch(() => null);
        let message = fallback;
        if (response.status === 401) message = 'Sua sessão terminou. Faça login novamente.';
        else if (response.status === 403) message = 'Você não tem permissão para realizar esta ação.';
        else if (response.status === 429) message = 'Muitas tentativas. Aguarde alguns minutos e tente novamente.';
        else if (response.status < 500) {
            const detail = data?.message || data?.error;
            if (typeof detail === 'string' && detail.length <= 240) message = detail;
        }
        const error = new Error(message);
        error.status = response.status;
        return error;
    }

    function errorMessage(error, fallback = 'Não foi possível concluir a operação.') {
        if (error?.name === 'AbortError') return 'O servidor demorou a responder. Tente novamente.';
        const message = error?.message;
        if (error instanceof TypeError && !/(failed to fetch|networkerror|load failed)/i.test(message || '')) return fallback;
        if (typeof message !== 'string' || !message.trim() || /<(!doctype|html)/i.test(message)) return fallback;
        if (/(failed to fetch|networkerror|load failed)/i.test(message)) return 'Não foi possível conectar ao servidor.';
        return message;
    }

    window.documentFeedback = { show, confirm, requestError, errorMessage };
})();
