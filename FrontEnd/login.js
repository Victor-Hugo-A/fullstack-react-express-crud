// URL base da API
const API_BASE_URL = 'http://localhost:3000';

// Função para exibir mensagem de sucesso
function exibirMensagemSucesso(mensagem) {
    const mensagemElemento = document.getElementById('mensagem-login');
    
    if (mensagemElemento) {
        mensagemElemento.textContent = mensagem;
        mensagemElemento.style.color = 'green';
        mensagemElemento.style.backgroundColor = '#e6ffe6';
        mensagemElemento.style.border = '2px solid #a3e8a3';
        mensagemElemento.style.display = 'block';
        
        setTimeout(() => {
            mensagemElemento.style.display = 'none';
        }, 2300);
    }
}

// Função para exibir mensagem de erro
function exibirMensagemErro(mensagem) {
    const mensagemElemento = document.getElementById('mensagem-login');
    
    if (mensagemElemento) {
        mensagemElemento.textContent = mensagem;
        mensagemElemento.style.color = 'red';
        mensagemElemento.style.backgroundColor = '#ffe6e6';
        mensagemElemento.style.border = '2px solid #ffb3b3';
        mensagemElemento.style.display = 'block';
        
        setTimeout(() => {
            mensagemElemento.style.display = 'none';
        }, 2300);
    }
}


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

        clearTimeout(timeout);

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            const error = new Error ( errorData.message ||errorData.error || `Erro HTTP ${response.status}`);
            error.status = response.status;
            throw error;
        }

    return await response.json(); // Sempre tenta parsear como JSON
        } catch (error) {
        console.error(`Erro na requisição ${endpoint}:`, error);
        throw new Error(
            error.name === 'AbortError' ? 'Tempo limite excedido' :
            error.message === 'Failed to fetch' ? 'Falha na conexão com o servidor' :
            error.message || 'Erro desconhecido'
        );
    }
} 

// Função para validar campos do formulário
function validarCampos(campos) {
    const camposVazios = Object.entries(campos)
        .filter(([_, value]) => !value)
        .map(([name]) => name);

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
        const buttonText = button.textContent;
        
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

            if (response.ok) {
            console.log('Login realizado com sucesso:', response);
            }

            if (!response.success) {
                throw new Error(response.error || 'invalid_response')
            }

            localStorage.setItem('token', response.token); // Token puro, sem JSON.stringify
            localStorage.setItem('userData', JSON.stringify({
                nome: response.user.nome,
                username: response.user.username,
                email: response.user.email,
                password: response.user.password
            }));
            
            setTimeout(() => {
                window.location.href = 'Sistema/sistema.html'; // Caminho relativo à página atual
            }, 1300);
            
            exibirMensagemSucesso(response.message || 'Login realizado com sucesso!');
            
        } catch (error) {
            switch(error.message) {
            case 'user_not_found':
                exibirMensagemErro('Usuário não registrado!');
                break;
            case 'invalid_password':
                exibirMensagemErro('Senha inválida. Tente novamente.');
                break;
            case 'missing_fields':
                exibirMensagemErro('Nome de usuário e senha são obrigatórias.');
                break;
            case 'tempo limite excedido':
                exibirMensagemErro('Servidor demorou a responder. Tente novamente');
                break;
            case 'failed to fetch':
                exibirMensagemErro('Não foi possível conectar ao servidor.');
                break;
            default:
                console.error('Erro no login', error);
                exibirMensagemErro('Erro ao fazer login. Tente Novamente.')
            }
            if (error.message === 'user_not_found') {
                setTimeout(() => {
                    document.getElementById('toggle-register')?.click();
                }, 1500);
            }
        } finally {
            button.textContent = buttonText;
            button.disabled = false;
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
    const buttonText = button.textContent;
    
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
        validarCampos({ nome, email, username, password, confirmPassword });
           
        if (password !== confirmPassword) {
            throw new Error('As senhas não coincidem!');
        }

        if (username.length < 3) {
            throw new Error ('O usuário deve conter pelo menos 3 letras')
        }

        if (password.length < 3) {
            throw new Error('A senha deve ter pelo menos 3 caracteres');
        }

        if (!validarCPF(cpf)) {
            exibirMensagemErro('CPF inválido. Digite um CPF real, apenas números ou com pontos.');
            return;
}

        // Fazer requisição de registro
        const response = await makeRequest('/register', 'POST', {
            nome, email, username, password, confirmPassword, cpf
        });
        
        exibirMensagemSucesso('Conta criada com sucesso! Faça login.');
        document.getElementById('login').style.display = 'block';
        document.getElementById('criar-conta').style.display = 'none';
        document.getElementById('registerForm').reset();
    } catch (error) {
        exibirMensagemErro(`Erro ao criar conta: ${error.message}`);
    } finally {
        button.textContent = buttonText;
        button.disabled = false;
    }
});

// Evento de submit do formulário de mudança de senha
document.getElementById('changePasswordForm')?.addEventListener('submit', async function(e) {
    e.preventDefault();
    const button = e.target.querySelector('button[type="submit"]');
    const buttonText = button.textContent;
        
    try {
        button.disabled = true;
        
        // Obter valores dos campos
        const username = document.getElementById('change-username').value;
        const currentPassword = document.getElementById('current-password').value;
        const newPassword = document.getElementById('new-password-change').value;
        const confirmNewPassword = document.getElementById('confirm-new-password').value;

        // Validar campos
        validarCampos({ username, currentPassword, newPassword, confirmNewPassword });
        
        if (newPassword !== confirmNewPassword) {
            throw new Error('As novas senhas não coincidem!');
        }

        if (newPassword.length < 3) {
            throw new Error('A nova senha deve ter pelo menos 3 caracteres');
        }
        

        exibirMensagemSucesso('Senha alterada com sucesso! Redirecionando para login...');
        
        document.getElementById('changePasswordForm').reset();
        
    setTimeout(() => {
        window.location.href = 'login.html';
    },  2000); /// 2 Segundos

    } catch (error) {
        exibirMensagemErro(`Erro ao alterar senha: ${error.message}`);
    } finally {
        button.textContent = buttonText;
        button.disabled = false;
    }

});

// Toggle entre login e registro
document.getElementById('toggle-register')?.addEventListener('click', function(e) {
    e.preventDefault();
    document.getElementById('login').style.display = 'none';
    document.getElementById('criar-conta').style.display = 'block';
});


// Voltar ao login a partir da mudança de senha
document.getElementById('back-to-login')?.addEventListener('click', function(e) {
    e.preventDefault();
    document.getElementById('login').style.display = 'block';
    document.getElementById('criar-conta').style.display = 'none';
});

// Toggle entre registro e login
document.getElementById('toggle-login')?.addEventListener('click', function(e) {
    e.preventDefault();
    document.getElementById('login').style.display = 'block';
    document.getElementById('criar-conta').style.display = 'none';
});

// Função para redirecionar para a página de login
function redirectToLogin() {
    sessionStorage.removeItem('token');
    sessionStorage.removeItem('userData');
    window.location.href = window.location.href.includes('Sistema') 
        ? '../login.html' 
        : 'login.html';
}

// Verificação de elementos DOM
function getElementOrThrow(id) {
    const element = document.getElementById(id);
    if (!element) {
        throw new Error(`Elemento com ID ${id} não encontrado`);
    }
    return element;
}