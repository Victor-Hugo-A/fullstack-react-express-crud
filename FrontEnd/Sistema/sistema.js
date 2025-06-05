document.addEventListener('DOMContentLoaded', function() {

// Atualiza a data atual
 function updateCurrentDate() {
    const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
        document.getElementById('current-date').textContent = new Date().toLocaleDateString('pt-BR', options);
}


    
    const userData = localStorage.getItem('userData');
    const { nome, username } = JSON.parse(userData);

    const usernameDisplay = document.getElementById('username-display')
        if (usernameDisplay) {
            usernameDisplay.textContent = nome || username;
    }
    
        const dateSpan = document.getElementById('current-date');
        const hoje = new Date();
        const dia = String(hoje.getDate()).padStart(2, '0');
        const mes = String(hoje.getMonth() + 1).padStart(2, '0');
        const ano = hoje.getFullYear();
            dateSpan.textContent = `${dia}/${mes}/${ano}`;
});



// Função de logout
function logout() {
    localStorage.removeItem('token');
    localStorage.removeItem('userData');
    window.location.href = '../login.html';
}


function redirectToLogin() {
    // Remove os itens de autenticação
    localStorage.removeItem('token');
    localStorage.removeItem('userData');
    
    // Usa um caminho relativo confiável
    window.location.href = window.location.href.includes('Sistema') 
        ? '../login.html' 
        : 'login.html';
}

// Verificação de elementos DOM:
function getElementOrThrow(id) {
    const element = document.getElementById(id);
        if (!element) {
        throw new Error(`Elemento com ID ${id} não encontrado`);
    }
    return element;
}

window.addEventListener('scroll', function() {
    const backToTop = document.querySelector('.back-to-top');
        if (window.pageYOffset > 300) {
        backToTop.classList.add('visible');
    }   else {
        backToTop.classList.remove('visible');
    }
});
