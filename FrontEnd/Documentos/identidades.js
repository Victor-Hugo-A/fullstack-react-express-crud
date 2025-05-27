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
                <img src="${BACKEND_URL}${id.foto}" alt="Foto 3x4" style="width:100px;height:100px;object-fit:cover;border-radius:4px;"
                onclick="abrirModalImagem('${BACKEND_URL}${id.foto}')" />
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


//Abrir modal de imagem
function abrirModalImagem(src) {
    const modal = document.getElementById('image-modal');
    const modalImg = document.getElementById('modal-image');
    modalImg.src = src;
    modal.style.display = 'flex';
    modal.style.justifyContent = 'center';
    modal.style.alignItems = 'center';
    modalImg.style.maxWidth = '90%';
    modalImg.style.maxHeight = '90%';
    modalImg.style.objectFit = 'contain';
    modalImg.style.borderRadius = '8px';
    modalImg.style.boxShadow = '0 4px 8px rgba(0, 0, 0, 0.2)';
    modalImg.style.transition = 'transform 0.3s ease';
    modalImg.onclick = function() {
        this.style.transform = 'scale(1.05)';
        setTimeout(() => {
            this.style.transform = 'scale(1)';
        }, 300);
    };
}

//Fechar modal de imagem
document.getElementById('close-modal').onclick = function() {
    document.getElementById('image-modal').style.display = 'none';
};
document.getElementById('image-modal').onclick = function(e) {
    if (e.target === this) {
        this.style.display = 'none';
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

window.abrirModalImagem = abrirModalImagem;
carregarIdentidades();
});