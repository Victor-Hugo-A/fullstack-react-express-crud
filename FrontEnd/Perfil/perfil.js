    document.addEventListener('DOMContentLoaded', function() {
        // Simulação de dados
        const userData = localStorage.getItem('userData')
            if(userData) {
                const usuario = JSON.parse(userData)
                document.getElementById('nome').value = usuario.nome || '';
                document.getElementById('email').value = usuario.email || '-';
                document.getElementById('cpf').value = usuario.cpf || '';
                document.getElementById('departamento').value = usuario.departamento || '-';
                document.getElementById('cargo').value = usuario.cargo || '-';
                // Para exibir nome no topo
                const usernameDisplay = document.getElementById('username-display')
                    if (usernameDisplay) {
                        usernameDisplay.textContent = usuario.nome || usuario.username || 'Usuário';
            }
        }
    
 // Atualiza apenas a senha
document.getElementById('perfil-form').addEventListener('submit', function(e) {
    e.preventDefault();
    const usuario = JSON.parse(localStorage.getItem('userData'));
    const username = usuario.username 
    const currentPassword = document.getElementById('senha-atual').value;
    const newPassword = document.getElementById('senha').value;
    const confirmNewPassword = document.getElementById('confirmar-senha').value;
    const departamento = document.getElementById('departamento').value;
    const cargo = document.getElementById('cargo').value;
    const cpf = document.getElementById('cpf').value;
    const token = localStorage.getItem('token');

    if(currentPassword || newPassword || confirmNewPassword) {
    if (currentPassword === newPassword) {
        exibirMensagemErro('A nova senha deve ser diferente da atual.');
        return;
    }
    if (newPassword.length < 8) {
        exibirMensagemErro('A senha deve conter pelo menos 8 caracteres.');
        return;
    }
    if (confirmNewPassword !== newPassword) {
        exibirMensagemErro('A confirmação de senha não coincide com a nova senha.');
        return;
    }

    // Altera a senha
        fetch('http://localhost:3000/change-password', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ 
                username,
                currentPassword,
                newPassword,
                confirmNewPassword
            })
        })
        .then(res => res.json())
        .then(data => {
            if (data && data.success) {
                exibirMensagemSucesso(data.message || 'Senha alterada com sucesso!');
                document.getElementById('senha-atual').value = '';
                document.getElementById('senha').value = '';
                document.getElementById('confirmar-senha').value = '';
            } else {
                exibirMensagemErro(data.message || 'Erro ao alterar senha.');
                throw new Error('Erro ao alterar senha');
            }
        })
        .catch(() => exibirMensagemErro('Erro ao conectar com o servidor'))
    }
            // Atualiza o cargo e departamento
            fetch('http://localhost:3000/update-profile', {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ username, departamento, cargo, cpf })
        })
        .then(res => res ? res.json() : null)
        .then(data => {
            if (data && data.success) {
                exibirMensagemSucesso('Perfil atualizado com sucesso!');
                if (data.user) {
                    localStorage.setItem('userData', JSON.stringify(data.user));
                    document.getElementById('departamento').value = data.user.departamento || '';
                    document.getElementById('cargo').value = data.user.cargo || '';
                    document.getElementById('cpf').value = data.user.cpf || '';
                }
            } else if (data) {
                exibirMensagemErro(data.message || 'Erro ao atualizar perfil.');
            }
        })
        .catch(() => exibirMensagemErro('Erro ao conectar com o servidor.'));
    });



        // ATUALIZA A DATA NO TOPO 
        const dateSpan = document.getElementById('current-date');
        const hoje = new Date();
        const dia = String(hoje.getDate()).padStart(2, '0');
        const mes = String(hoje.getMonth() + 1).padStart(2, '0');
        const ano = hoje.getFullYear();
            dateSpan.textContent = `${dia}/${mes}/${ano}`;
});

function logout() {
    localStorage.removeItem('token');
    localStorage.removeItem('userData');
    window.location.href = '../login.html';
}
       
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
        }, 5000);
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
        }, 3500);
    }
}
