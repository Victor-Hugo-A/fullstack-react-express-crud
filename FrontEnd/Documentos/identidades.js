document.addEventListener('DOMContentLoaded', () => {
    const API_URL = 'http://localhost:3000/api/identities';
    
    
    function cpfValue(cpf) {
        try {
            if (!/^\d{11}$/.test(cpf)) {
                throw new Error('CPF deve ter 11 dígitos numéricos');
            }
            if  (/^(\d)\1+$/.test(cpf)) {
                throw new Error('CPF inválido');
                }
                // Fomatação do CPF
                return cpf.replace(/(^\d{3})(\d{3})(\d{3})(\d{2})$/, '$1.$2.$3-$4');
            }  catch (error) {
                ErroMessage(error.message, 'error');
                return '';
            }
        }
        
        async function cpfJaCadastrado(cpf) {
            const response = await fetch (API_URL)
            if (!response.ok) return false;
            const identidades = await response.json();
            return identidades.some(id => id.cpf.replace(/\D/g, '') === cpf);
        }

        document.getElementById('identity-form').addEventListener('submit', async function(e) {
    e.preventDefault();
    const cpfInput = document.getElementById('cpf');
    const cpf = cpfInput.value.replace(/\D/g, ''); // Remove caracteres não numéricos

    const cpfFormatado = cpfValue(cpf);
    if (!cpfFormatado) return

    if (await cpfJaCadastrado(cpf)) {
        ErroMessage('CPF já cadastrado!', 'error');
        return;
    }

    const formData = new FormData(this);
    const response = await fetch(API_URL, {
        method: 'POST',
        body: formData
    });
    const data = await response.json();
    if(data.success) {
        SuccessMessage('Identidade cadastrada com sucesso!', 'success');
        this.reset();
        carregarIdentidades();
    } else {
        ErroMessage('Erro ao cadastrar identidade!', 'error');
    }

});


    async function carregarIdentidades() {
        const response = await fetch(API_URL);
        if(!response.ok) {
            ErroMessage('Erro ao carregar identidades!', 'error');
            return;
        }

const identidades = await response.json();
const tbody = document.getElementById('identities-table').querySelector('tbody');
tbody.innerHTML = ''; // Limpa o conteúdo atual da tabela
identidades.forEach(id => {
    const BACKEND_URL = 'http://localhost:3000';
    const perfilClass = `perfil-${(id.perfil || '').toLowerCase()}`;
    const tr = document.createElement('tr');
    tr.innerHTML = `
        <td>${id.nome}</td>
        <td>${id.cpf}</td>
        <td>${id.endereco}</td>
        <td><span class="${perfilClass}">${id.perfil}</span></td>
        <td>
            <img src="${BACKEND_URL}${id.foto}" alt="Foto 3x4" style="width:80px;height:80px;object-fit:cover;border-radius:4px;cursor:pointer;" />
        </td>
        <td>
            <button class="btn btn-danger btn-sm btn-excluir" title="Excluir identidade">Excluir</button>
        </td>
    `;

    // Evento para abrir modal da imagem
    tr.querySelector('img').addEventListener('click', () => abrirModalImagem(`${BACKEND_URL}${id.foto}`));
    // Evento para excluir identidade
    tr.querySelector('.btn-excluir').addEventListener('click', () => deletarIdentidade(id.id));
    tbody.appendChild(tr);
});
}


window.deletarIdentidade = async function(id) {
    if(!confirm('Tem certeza que deseja excluir esta identidade?')) return;
    const res = await fetch(`${API_URL}/${id}`, { method: 'DELETE' });
    const data = await res.json();
        if(data.success) {
            SuccessMessage('Identidade excluída com sucesso!', 'success');
            carregarIdentidades();
        } else {
            ErroMessage('Erro ao excluir identidade!', 'error');
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
    modalImg.style.maxWidth = '100%';
    modalImg.style.maxHeight = '100%';
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

window.abrirModalImagem = abrirModalImagem;
carregarIdentidades();

const identityMessage = document.getElementById('identity-message');
  function ErroMessage(message, type) {
    identityMessage.textContent = message;
    identityMessage.className = `message ${type}`;
    identityMessage.style.display = 'block';
    identityMessage.style.backgroundColor ='#f8d7da';

    setTimeout(() => {
      identityMessage.style.display = 'none';
    }, 5000);
  }


  function SuccessMessage(message, type) {
    identityMessage.textContent = message;
    identityMessage.className = `message ${type}`;
    identityMessage.style.display = 'block';
    identityMessage.style.backgroundColor = '#7CFC00' 

    setTimeout(() => {
      identityMessage.style.display = 'none';
    }, 5000);
  }

});