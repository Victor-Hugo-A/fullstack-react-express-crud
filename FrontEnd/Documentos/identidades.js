document.addEventListener('DOMContentLoaded', () => {
const API_URL = 'http://localhost:3000/api/identities';
    
let allIdentidades = [];
let currentPage = 1;
const IDENTIDADES_PER_PAGE = 6;
const activeImageUrls = new Set();
const BACKEND_URL = 'http://localhost:3000';
const escapeHTML = value => String(value ?? '').replace(/[&<>"']/g, char => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
}[char]));

async function loadIdentityPhoto(img, filePath) {
    if (!/^\/uploads\/identities\/[^/]+$/.test(filePath || '')) return;
    try {
        const response = await fetch(`${BACKEND_URL}${filePath}`, {
            headers: { Authorization: `Bearer ${sessionStorage.getItem('portal-session')}` }
        });
        if (!response.ok) return;
        const imageUrl = URL.createObjectURL(await response.blob());
        if (!img.isConnected) {
            URL.revokeObjectURL(imageUrl);
            return;
        }
        activeImageUrls.add(imageUrl);
        img.src = imageUrl;
        img.classList.add('has-photo');
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
                headers: { 'Authorization': `Bearer ${sessionStorage.getItem('portal-session')}` }
            });
            if (!response.ok) throw await window.documentFeedback.requestError(response, 'Não foi possível verificar o CPF.');
            const identidades = await response.json();
            if (!Array.isArray(identidades)) throw new Error('Não foi possível verificar o CPF.');
            return identidades.some(id => String(id.cpf || '').replace(/\D/g, '') === cpf);
        }

        document.getElementById('identity-form').addEventListener('submit', async function(e) {
    e.preventDefault();
    const submitButton = this.querySelector('button[type="submit"]');
    submitButton.disabled = true;
    try {
        const token = sessionStorage.getItem('portal-session');
        if (!token) throw new Error('Sua sessão terminou. Faça login novamente.');
        const cpf = document.getElementById('cpf').value.replace(/\D/g, '');
        if (!cpfValue(cpf)) return;
        if (await cpfJaCadastrado(cpf)) {
            ErroMessage('CPF já cadastrado!', 'error');
            return;
        }

        const response = await fetch(API_URL, {
            method: 'POST',
            body: new FormData(this),
            headers: { Authorization: `Bearer ${token}` }
        });
        if (!response.ok) throw await window.documentFeedback.requestError(response, 'Não foi possível cadastrar a identidade.');
        const data = await response.json();
        if (!data.success) throw new Error(data.message || data.error || 'Não foi possível cadastrar a identidade.');
        SuccessMessage('Identidade cadastrada com sucesso!', 'success');
        this.reset();
        carregarIdentidades().catch(error => ErroMessage(window.documentFeedback.errorMessage(error, 'Não foi possível atualizar a lista de identidades.'), 'error'));
    } catch (error) {
        ErroMessage(window.documentFeedback.errorMessage(error, 'Não foi possível cadastrar a identidade.'), 'error');
    } finally {
        submitButton.disabled = false;
    }

});


    async function carregarIdentidades() {
        const response = await fetch(API_URL, {
            headers: { 'Authorization': `Bearer ${sessionStorage.getItem('portal-session')}` }
        });
        if(!response.ok) {
            const error = await window.documentFeedback.requestError(response, 'Não foi possível carregar as identidades.');
            ErroMessage(error.message, 'error');
            return;
        }
        allIdentidades = await response.json();
        currentPage = Math.min(currentPage, Math.max(1, Math.ceil(allIdentidades.length / IDENTIDADES_PER_PAGE)));
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
    tbody.innerHTML = '<tr><td colspan="7">Nenhuma identidade encontrada</td></tr>';
    renderIdentidadesPagination();
    return;
  }

    identidadesToShow.forEach(id => {
        const perfilClass = `perfil-${(id.perfil || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9-]/g, '')}`;
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
                <img class="identity-photo" src="${window.documentIcons.dataUri('profile')}" alt="Fotografia de ${escapeHTML(id.nome)}" />
            </td>
            <td>${dataCriacao}</td>
            <td class="identity-actions">
                <button class="btn btn-danger btn-sm btn-excluir" type="button" data-admin-only title="Excluir identidade">${window.documentIcons.markup('trash')} Excluir</button>
                <span class="readonly-label">Somente leitura</span>
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
        window.documentPagination.render(document.querySelector('.pagination'), currentPage, totalPages);
    }

    document.querySelector('.pagination')?.addEventListener('click', event => {
        const button = event.target.closest('button[data-page]');
        if (!button || button.disabled) return;
        const totalPages = Math.ceil(allIdentidades.length / IDENTIDADES_PER_PAGE);
        currentPage = button.dataset.page === 'prev' ? currentPage - 1
            : button.dataset.page === 'next' ? currentPage + 1 : Number(button.dataset.page);
        currentPage = Math.min(Math.max(currentPage, 1), totalPages);
        renderIdentidadesPage(currentPage);
    });
    }


    window.deletarIdentidade = async function(id) {
        if(!confirm('Tem certeza que deseja excluir esta identidade?')) return;
        try {
            const res = await fetch(`${API_URL}/${id}`, {
                method: 'DELETE',
                headers: { 'Authorization': `Bearer ${sessionStorage.getItem('portal-session')}` }
            });
            const data = await res.json().catch(() => ({}));
            if (!res.ok || !data.success) {
                if (!res.ok) {
                    const error = new Error(res.status === 403
                        ? 'Você não tem permissão para excluir identidades.'
                        : res.status === 401
                            ? 'Sua sessão terminou. Faça login novamente.'
                            : res.status >= 500
                                ? 'Não foi possível excluir a identidade agora.'
                                : data.message || data.error || 'Não foi possível excluir a identidade.');
                    error.status = res.status;
                    throw error;
                }
                throw new Error(data.message || data.error || 'Não foi possível excluir a identidade.');
            }
            SuccessMessage('Identidade excluída com sucesso!', 'success');
            await carregarIdentidades();
        } catch (error) {
            ErroMessage(window.documentFeedback.errorMessage(error, 'Não foi possível excluir a identidade.'), 'error');
        }
    }


//Abrir modal de imagem
function abrirModalImagem(src) {
    const modal = document.getElementById('image-modal');
    const modalImg = document.getElementById('modal-image');
    modalImg.src = src;
    modal.hidden = false;
    document.getElementById('close-modal').focus();
}

//Fechar modal de imagem
function fecharModalImagem() {
    const modal = document.getElementById('image-modal');
    modal.hidden = true;
    document.getElementById('modal-image').removeAttribute('src');
}
document.getElementById('close-modal').onclick = function() {
    fecharModalImagem();
};
document.getElementById('image-modal').onclick = function(e) {
    if (e.target === this) {
        fecharModalImagem();
    }
}
document.addEventListener('keydown', event => {
    if (event.key === 'Escape' && !document.getElementById('image-modal').hidden) fecharModalImagem();
});

window.abrirModalImagem = abrirModalImagem;
carregarIdentidades().catch(error => ErroMessage(window.documentFeedback.errorMessage(error, 'Não foi possível carregar as identidades.'), 'error'));


const identityMessage = document.getElementById('identity-message');
  function ErroMessage(message, type) {
    window.documentFeedback.show(identityMessage, message, 'error');
  }


  function SuccessMessage(message, type) {
    window.documentFeedback.show(identityMessage, message, 'success');
  }

})
