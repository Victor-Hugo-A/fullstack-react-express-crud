window.apiGet = async function apiGet(path) {
    const token = localStorage.getItem('token');
    if (!token) {
        window.location.replace('/FrontEnd/login.html');
        throw new Error('Faça login para acessar os dados.');
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);
    try {
        const response = await fetch(`http://localhost:3000${path}`, {
            headers: { Authorization: `Bearer ${token}` },
            signal: controller.signal
        });
        if (response.status === 401 || response.status === 403) {
            localStorage.removeItem('token');
            localStorage.removeItem('userData');
            window.location.replace('/FrontEnd/login.html');
            throw new Error('Sessão encerrada. Faça login novamente.');
        }
        if (!response.ok) {
            throw new Error(`Não foi possível carregar os dados (HTTP ${response.status}).`);
        }
        return await response.json();
    } catch (error) {
        if (error.name === 'AbortError') {
            throw new Error('O servidor demorou a responder. Tente novamente.');
        }
        throw error;
    } finally {
        clearTimeout(timeout);
    }
};
