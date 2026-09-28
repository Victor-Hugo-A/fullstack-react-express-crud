document.addEventListener('DOMContentLoaded', () => {
const API_URL = 'http://localhost:3000/api/identities';
    
let allIdentidades = [];
let currentPage = 1;
const IDENTIDADES_PER_PAGE = 5;
const activeImageUrls = new Set();
const BACKEND_URL = 'http://localhost:3000';
const escapeHTML = value => String(value ?? '').replace(/[&<>"']/g, char => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
}[char]));

async function loadIdentityPhoto(img, filePath) {
    if (!/^\/uploads\/identities\/[^/]+$/.test(filePath || '')) return;
    try {
        const response = await fetch(`${BACKEND_URL}${filePath}`, {
            headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
        });
        if (!response.ok) return;
        const imageUrl = URL.createObjectURL(await response.blob());
        if (!img.isConnected) {
            URL.revokeObjectURL(imageUrl);
            return;
        }
        activeImageUrls.add(imageUrl);
        img.src = imageUrl;
        img.addEventListener('click', () => abrirModalImagem(imageUrl));
    } catch (error) {
        console.error('Falha ao carregar foto:', error);
    }
}

    
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
            const response = await fetch(API_URL, {
                headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
            });
            if (!response.ok) return false;
            const identidades = await response.json();
            return identidades.some(id => id.cpf.replace(/\D/g, '') === cpf);
        }

        document.getElementById('identity-form').addEventListener('submit', async function(e) {
    e.preventDefault();
    const cpfInput = document.getElementById('cpf');
    const token = localStorage.getItem('token');
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
        body: formData,
        headers: {
            'Authorization': `Bearer ${token}`
        }
    });
    const data = await response.json();
    if(data.success) {
        SuccessMessage('Identidade cadastrada com sucesso!', 'success');
        this.reset();
        carregarIdentidades();
    } else {
        ErroMessage('Acesso restrito! Faça login para continuar.', 'error');
    }

});


    async function carregarIdentidades() {
        const response = await fetch(API_URL, {
            headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
        });
        if(!response.ok) {
            ErroMessage('Erro ao carregar identidades!', 'error');
            return;
        }
        allIdentidades = await response.json();
        renderIdentidadesPage(currentPage)

    function renderIdentidadesPage(page) {
    const tbody = document.getElementById('identities-table').querySelector('tbody');
    activeImageUrls.forEach(url => URL.revokeObjectURL(url));
    activeImageUrls.clear();
    tbody.innerHTML = '';
    const start = (page - 1) * IDENTIDADES_PER_PAGE;
    const end = start + IDENTIDADES_PER_PAGE;
    const identidadesToShow = allIdentidades.slice(start, end);

    if (identidadesToShow.length === 0) {
    tbody.innerHTML = '<tr><td colspan="6">Nenhuma identidade encontrado</td></tr>';
    return;
  }

    identidadesToShow.forEach(id => {
        const perfilClass = `perfil-${(id.perfil || '').toLowerCase().replace(/[^a-z0-9-]/g, '')}`;
        const dataCriacao = id.created_at
        ? new Date(id.created_at).toLocaleDateString('pt-BR')
        : '—';
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>${escapeHTML(id.nome)}</td>
            <td>${escapeHTML(id.cpf)}</td>
            <td>${escapeHTML(id.endereco)}</td>
            <td><span class="${perfilClass}">${escapeHTML(id.perfil)}</span></td>
            <td>
                <img src="/FrontEnd/img/profile.png" alt="Foto da identidade" style="width:80px;height:80px;object-fit:cover;border-radius:4px;cursor:pointer;" />
            </td>
            <td>${dataCriacao}</td>
            <td>
                <button class="btn btn-danger btn-sm btn-excluir" title="Excluir identidade">Excluir</button>
            </td>
        `;

        // Evento para abrir modal da imagem
        loadIdentityPhoto(tr.querySelector('img'), id.foto);
        // Evento para excluir identidade
        tr.querySelector('.btn-excluir').addEventListener('click', () => deletarIdentidade(id.id));
        tbody.appendChild(tr);
        });

        renderIdentidadesPagination();

    }

    function renderIdentidadesPagination() {
        const totalPages = Math.ceil(allIdentidades.length / IDENTIDADES_PER_PAGE);
        const pagination = document.querySelector('.pagination');
        if (!pagination) return;
        pagination.innerHTML = `
        <a href="#" class="page-nav" data-page="prev"><i class="fas fa-angle-double-left"></i></a>
            ${Array.from({length: totalPages}, (_, i) => `
                <a href="#" class="page-link${i+1 === currentPage ? ' active' : ''}" data-page="${i+1}">${i+1}</a>
            `).join('')}
            <a href="#" class="page-nav" data-page="next"><i class="fas fa-angle-double-right"></i></a>
        `;
    }

    document.addEventListener('click', function(e) {
        if (e.target.closest('.page-link')) {
            e.preventDefault();
            currentPage = Number(e.target.closest('.page-link').dataset.page);
            renderIdentidadesPage(currentPage);
        }
        if (e.target.closest('.page-nav')) {
            e.preventDefault();
            const nav = e.target.closest('.page-nav').dataset.page;
            const totalPages = Math.ceil(allIdentidades.length / IDENTIDADES_PER_PAGE);
            if (nav === 'prev' && currentPage > 1) currentPage--;
            if (nav === 'next' && currentPage < totalPages) currentPage++;
            renderIdentidadesPage(currentPage);
            }
        });
    }


    window.deletarIdentidade = async function(id) {
        if(!confirm('Tem certeza que deseja excluir esta identidade?')) return;
        const token = localStorage.getItem('token');
        const res = await fetch(`${API_URL}/${id}`,
            { 
                method: 'DELETE', 
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });
        const data = await res.json();
            if(data.success) {
                SuccessMessage('Identidade excluída com sucesso!', 'success');
                carregarIdentidades();
            } else {
                ErroMessage('Acesso restrito! Faça login para continuar.', 'error');
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

})
