document.addEventListener('DOMContentLoaded', () => {
    const API_URL = 'http://localhost:3000/api/identities';

async function carregarIdentidades() {
        const response = await fetch(API_URL);
        if(!response.ok) {
            showIdentityMessage('Erro ao carregar identidades!', 'error');
            return;
        }

        const identidades = await response.json();
        const tbody = document.getElementById('identities-table').querySelector('tbody');
        tbody.innerHTML = ''; // Limpa o conteúdo atual da tabela
        identidades.forEach(id => {
            const BACKEND_URL = 'http://localhost:3000';
            tbody.innerHTML += `
                <tr>
                <td>${id.nome}</td>
                <td>${id.cpf}</td>
                <td>${id.endereco}</td>
                <td>${id.perfil}</td>
                <td>
                <img src="${BACKEND_URL}${id.foto}" alt="Foto 3x4" style="width:48px;height:64px;object-fit:cover;border-radius:4px;">
                <button class = "btn btn-danger btn-sm" onclick="deletarIdentidade('${id.id}')">Excluir</button>
                </td>
                </tr>
            `;
        });
    }      

document.getElementById('identity-form').addEventListener('submit', async function(e) {
    e.preventDefault();
    const formData = new FormData(this);
    const response = await fetch(API_URL, {
        method: 'POST',
        body: formData
    });
    const data = await response.json();
    if(data.success) {
        showIdentityMessage('Identidade cadastrada com sucesso!', 'success');
        this.reset();
        carregarIdentidades();
    } else {
        showIdentityMessage('Erro ao cadastrar identidade!', 'error');
    }
});

window.deletarIdentidade = async function(id) {
    if(!confirm('Tem certeza que deseja excluir esta identidade?')) return;
    const res = await fetch(`${API_URL}/${id}`, { method: 'DELETE' });
    const data = await res.json();
        if(data.success) {
            showIdentityMessage('Identidade excluída com sucesso!', 'success');
            carregarIdentidades();
        } else {
            showIdentityMessage('Erro ao excluir identidade!', 'error');
        }
}

function showIdentityMessage(msg, type) {
    const msgDiv = document.getElementById('identity-message');
    msgDiv.textContent = msg;
    msgDiv.className = `message ${type}`;
    msgDiv.style.display = 'block';
    setTimeout(() => {
        msgDiv.style.display = 'none';
    }, 4000);
}

carregarIdentidades();
});