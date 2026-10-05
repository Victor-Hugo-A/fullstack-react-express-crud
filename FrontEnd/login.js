// URL base da API
const API_BASE_URL = 'http://localhost:3000';

function mostrarMensagem(mensagem, tipo) {
    const elemento = document.getElementById('mensagem-login');
    window.appNotice.show(elemento, mensagem, tipo);
}

function exibirMensagemSucesso(mensagem) { mostrarMensagem(mensagem, 'success'); }
function exibirMensagemErro(mensagem) { mostrarMensagem(mensagem, 'error'); }

const authNotice = sessionStorage.getItem('auth-notice');
sessionStorage.removeItem('auth-notice');
if (authNotice === 'logout') exibirMensagemSucesso('Você saiu da sua conta com segurança.');
if (authNotice === 'expired') exibirMensagemErro('Sua sessão terminou. Faça login novamente.');
if (authNotice === 'required') exibirMensagemErro('Faça login para continuar.');


// Função para fazer requisições à API
async function makeRequest(endpoint, method, data) {
    const url = `${API_BASE_URL}${endpoint}`;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);

    try {
        const response = await fetch(url, {
            method,
            mode: 'cors',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data),
            signal: controller.signal,
            credentials: 'include'
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            const error = new Error ( errorData.message ||errorData.error || `Erro HTTP ${response.status}`);
            error.status = response.status;
            throw error;
        }

    return await response.json(); // Sempre tenta parsear como JSON
        } catch (error) {
        console.error(`Erro na requisição ${endpoint}:`, error);
        if (error.name === 'AbortError') throw new Error('tempo limite excedido');
        if (error instanceof TypeError) throw new Error('Falha na conexão com o servidor');
        throw error;
    } finally {
        clearTimeout(timeout);
    }
} 

// Função para validar campos do formulário
function validarCampos(campos) {
    const labels = { nome: 'nome', cpf: 'CPF', email: 'e-mail', username: 'usuário', password: 'senha', confirmPassword: 'confirmação da senha' };
    const camposVazios = Object.entries(campos)
        .filter(([_, value]) => !String(value ?? '').trim())
        .map(([name]) => labels[name] || name);

    if (camposVazios.length > 0) {
        throw new Error(`Os seguintes campos são obrigatórios: ${camposVazios.join(', ')}`);
    }
}


// Evento de submit do formulário de login
const loginForm = document.getElementById('loginForm');
if (loginForm) {
    loginForm.addEventListener('submit', async function(e) {
        e.preventDefault();
        const button = e.target.querySelector('button[type="submit"]');
        const buttonContent = button.innerHTML;
        let loginSucceeded = false;
        
        try {
            // Mostrar estado de carregamento
            button.disabled = true;
            button.innerHTML = '<span class="loading-spinner"></span> Logando...';
            exibirMensagemErro('');

            // Validar campos
            const username = document.getElementById('username').value.trim();
            const password = document.getElementById('password').value;

            if (!username || !password) {
                throw new Error ('missing_fields');
            }

            // Fazer requisição de login
            const response = await makeRequest('/login', 'POST', { username, password });

            if (!response.success || !response.user) {
                throw new Error(response.error || 'invalid_response')
            }

            sessionStorage.setItem('portal-session', 'active');
            sessionStorage.setItem('userData', JSON.stringify(response.user));
            sessionStorage.setItem('auth-notice', 'login');
            loginSucceeded = true;
            exibirMensagemSucesso('Login realizado com sucesso. Redirecionando...');
            setTimeout(() => {
                window.location.assign('/FrontEnd/Sistema/sistema.html');
            }, 900);
            
        } catch (error) {
            if (error.status === 401) {
                exibirMensagemErro('Usuário ou senha inválidos.');
            } else if (error.status === 403) {
                exibirMensagemErro(error.message);
            } else if (error.status === 429) {
                exibirMensagemErro('Muitas tentativas. Aguarde alguns minutos antes de tentar novamente.');
            } else if (error.status === 400 || error.message === 'missing_fields') {
                exibirMensagemErro('Informe o usuário e a senha.');
            } else if (error.message === 'tempo limite excedido') {
                exibirMensagemErro('O servidor demorou a responder. Tente novamente.');
            } else if (error.message === 'Falha na conexão com o servidor') {
                exibirMensagemErro('Não foi possível conectar ao servidor.');
            } else {
                console.error('Erro no login', error);
                exibirMensagemErro('Não foi possível entrar agora. Tente novamente em instantes.');
            }
        } finally {
            if (!loginSucceeded) {
                button.innerHTML = buttonContent;
                button.disabled = false;
            }
        }
    });
}

function validarCPF(cpf) {
    cpf = cpf.replace(/[^\d]+/g, '');
    if (cpf.length !== 11) return false;
    if (/^(\d)\1+$/.test(cpf)) return false; // todos iguais

    let soma = 0, resto;
    for (let i = 1; i <= 9; i++) soma += parseInt(cpf.substring(i-1, i)) * (11 - i);
    resto = (soma * 10) % 11;
    if ((resto === 10) || (resto === 11)) resto = 0;
    if (resto !== parseInt(cpf.substring(9, 10))) return false;

    soma = 0;
    for (let i = 1; i <= 10; i++) soma += parseInt(cpf.substring(i-1, i)) * (12 - i);
    resto = (soma * 10) % 11;
    if ((resto === 10) || (resto === 11)) resto = 0;
    if (resto !== parseInt(cpf.substring(10, 11))) return false;

    return true;
}


// Evento de submit do formulário de registro
document.getElementById('registerForm')?.addEventListener('submit', async function(e) {
    e.preventDefault();
    const button = e.target.querySelector('button[type="submit"]');
    const buttonContent = button.innerHTML;
    
    try {
        button.disabled = true;
        
        // Obter valores dos campos
        const nome = document.getElementById('nome').value;
        const email = document.getElementById('email').value;
        const username = document.getElementById('new-username').value;
        const password = document.getElementById('new-password').value;
        const confirmPassword = document.getElementById('confirm-password').value;
        const cpf = document.getElementById('cpf').value;

        // Validar campos
        validarCampos({ nome, cpf, email, username, password, confirmPassword });
           
        if (password !== confirmPassword) {
            throw new Error('As senhas não coincidem!');
        }

        if (username.length < 3) {
            throw new Error ('O usuário deve conter pelo menos 3 letras')
        }

        if (password.length < 8) {
            throw new Error('A senha deve ter pelo menos 8 caracteres');
        }

        if (!validarCPF(cpf)) {
            exibirMensagemErro('CPF inválido. Digite um CPF real, apenas números ou com pontos.');
            return;
}

        // Fazer requisição de registro
        await makeRequest('/register', 'POST', {
            nome, email, username, password, confirmPassword, cpf
        });
        
        exibirMensagemSucesso('Solicitação enviada. Você poderá entrar após a aprovação administrativa.');
        mostrarSecao('login');
        document.getElementById('username').value = username;
        document.getElementById('registerForm').reset();
    } catch (error) {
        const reason = error.status === 429
            ? 'Muitas tentativas. Aguarde alguns minutos e tente novamente.'
            : error.status >= 500
                ? 'Não foi possível criar a conta agora. Tente novamente em instantes.'
                : error.message === 'Falha na conexão com o servidor'
                    ? 'Não foi possível conectar ao servidor.'
                    : error.message === 'tempo limite excedido'
                        ? 'O servidor demorou a responder. Tente novamente.'
                    : error.message;
        exibirMensagemErro(reason);
    } finally {
        button.innerHTML = buttonContent;
        button.disabled = false;
    }
});

function mostrarSecao(secao) {
    document.getElementById('login').hidden = secao !== 'login';
    document.getElementById('criar-conta').hidden = secao !== 'criar-conta';
    const primeiroCampo = secao === 'login' ? 'username' : 'nome';
    document.getElementById(primeiroCampo).focus();
}

// Toggle entre login e registro
document.getElementById('toggle-register')?.addEventListener('click', function(e) {
    e.preventDefault();
    exibirMensagemErro('');
    mostrarSecao('criar-conta');
});


// Voltar ao login a partir da mudança de senha
document.getElementById('back-to-login')?.addEventListener('click', function(e) {
    e.preventDefault();
    exibirMensagemErro('');
    mostrarSecao('login');
});

// Toggle entre registro e login
document.getElementById('toggle-login')?.addEventListener('click', function(e) {
    e.preventDefault();
    exibirMensagemErro('');
    mostrarSecao('login');
});

// Verificação de elementos DOM
function getElementOrThrow(id) {
    const element = document.getElementById(id);
    if (!element) {
        throw new Error(`Elemento com ID ${id} não encontrado`);
    }
    return element;
}
