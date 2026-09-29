(() => {
    const timers = new WeakMap();

    function show(element, message, type = 'info') {
        if (!element) return;
        clearTimeout(timers.get(element));
        const kind = ['success', 'error', 'info'].includes(type) ? type : 'info';
        element.textContent = message;
        element.className = `message ${kind}`;
        element.setAttribute('role', kind === 'error' ? 'alert' : 'status');
        element.hidden = false;
        element.style.display = 'block';
        if (kind !== 'error') {
            timers.set(element, setTimeout(() => {
                element.hidden = true;
                element.style.display = 'none';
            }, 6000));
        }
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

    window.documentFeedback = { show, requestError, errorMessage };
})();
