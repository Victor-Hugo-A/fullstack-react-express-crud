const API_BASE_URL = 'http://localhost:3000/api';
const escapeHTML = value => String(value ?? '').replace(/[&<>"']/g, char => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
}[char]));

document.addEventListener('DOMContentLoaded', function() {
    const elements = {
        form: document.getElementById('document-form'),
        contractType: document.getElementById('contract-type'),
        contractNumber: document.getElementById('contract-number'),
        contractDate: document.getElementById('contract-date'),
        contractFile: document.getElementById('contract-file'),
        contractDescription: document.getElementById('contract-description'),
        documentsContainer: document.getElementById('documents-container'),
        loadingIndicator: document.getElementById('loading-documents'),
        uploadMessage: document.getElementById('upload-message'),
        filterType: document.getElementById('filter-type'),
        filterYear: document.getElementById('filter-year'),
        searchContract: document.getElementById('search-contract'),
        cleanAllButton: document.getElementById('clean-all-button')
    };

    // Funções de exibição de mensagens
    function showSuccessMessage(message) {
    const msg = document.getElementById('contract-message');
    msg.textContent = message;
    msg.className = 'message success';
    msg.style.display = 'block';
    setTimeout(() => {
        msg.style.display = 'none';
    }, 5000);
    }

    function showErrorMessage(message) {
    const msg = document.getElementById('contract-message');
    msg.textContent = message;
    msg.className = 'message error';
    msg.style.display = 'block';
    setTimeout(() => {
        msg.style.display = 'none';
    }, 5000);
}


    // Configuração inicial da data (mínimo 2025-01, máximo 2040-12)
    function setupDateValidation() {
        const today = new Date();
        const minDate = new Date(2025, 0, 1); // Janeiro 2025
        const maxDate = new Date(2040, 11, 1); // Dezembro 2040 (11 = Dezembro)
        
        elements.contractDate.min = formatDate(minDate);
        elements.contractDate.max = formatDate(maxDate);
        
        // Define a data padrão como a data atual, respeitando os limites
        const defaultDate = today < minDate ? minDate : 
                           today > maxDate ? maxDate : today;
        
        elements.contractDate.valueAsDate = defaultDate;
    }

    function formatDate(date) {
        return date.toISOString().split('T')[0];
    }

    // Validação do formulário
    async function validateForm() {
        let isValid = true;
        clearErrors();
        
        // Validação do tipo de contrato
        if (!elements.contractType.value) {
            showError(elements.contractType, 'Selecione um tipo de contrato');
            isValid = false;
        }
        
        // Validação do número do contrato
        const contractNumber = elements.contractNumber.value.trim();
        if (!contractNumber) {
            showError(elements.contractNumber, 'Informe o número do contrato');
            isValid = false;
        } else if (!/^[a-zA-Z0-9\-_]+$/.test(contractNumber)) {
            showError(elements.contractNumber, 'Use apenas letras, números, hífens ou underscores');
            isValid = false;
        } else {
            // Verificação se o contrato já existe
            const exists = await checkContractExists(contractNumber);
            if (exists) {
                showError(elements.contractNumber, 'Este número de contrato já está em uso');
                isValid = false;
            }
        }
        
        // Validação do arquivo
        const file = elements.contractFile.files[0];
        if (!file) {
            showError(elements.contractFile, 'Selecione um arquivo');
            isValid = false;
        } else {
            const validTypes = ['application/pdf', 'application/msword', 
                               'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 
                               'image/jpeg', 'image/png'];
            const maxSize = 10 * 1024 * 1024; // 10MB
            
            if (!validTypes.includes(file.type)) {
                showError(elements.contractFile, 'Formato de arquivo inválido. Use PDF, Word ou imagens (JPEG/PNG)');
                isValid = false;
            }
            
            if (file.size > maxSize) {
                showError(elements.contractFile, 'Arquivo muito grande (máx. 10MB)');
                isValid = false;
            }
        }
        
        return isValid;
    }

    async function checkContractExists(contractNumber) {
        try {
            const response = await fetch(`${API_BASE_URL}/contracts/check?number=${encodeURIComponent(contractNumber)}`, {
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('token')}`
                }
            });

            if (!response.ok) {
                throw new Error('Erro ao verificar contrato');
            }

            const result = await response.json();
            return result.exists;
        } catch (error) {
            console.error('Erro ao verificar contrato:', error);
            showErrorMessage('Erro ao verificar contrato. Tente novamente');
            return false;
        }
    }

    function showError(element, message) {
        const formGroup = element.closest('.form-group');
        if (!formGroup) return;
        
        let errorElement = formGroup.querySelector('.error-message');
        if (!errorElement) {
            errorElement = document.createElement('div');
            errorElement.className = 'error-message text-danger mt-1';
            formGroup.appendChild(errorElement);
        }
        
        errorElement.textContent = message;
        element.classList.add('is-invalid');
    }

    function clearErrors() {
        document.querySelectorAll('.is-invalid').forEach(el => {
            el.classList.remove('is-invalid');
        });
        
        document.querySelectorAll('.error-message').forEach(el => {
            el.remove();
        });
    }

    // Envio do formulário
    async function handleFormSubmit(e) {
        e.preventDefault();
        clearErrors();
        
        const submitButton = elements.form.querySelector('button[type="submit"]');
        submitButton.disabled = true;
        
        try {
            const isValid = await validateForm();
            if (!isValid) {
                submitButton.disabled = false;
                return;
            }
        
            showLoading(true);
            
            const formData = new FormData();
            formData.append('type', elements.contractType.value);
            formData.append('number', elements.contractNumber.value.trim());
            formData.append('date', elements.contractDate.value);
            formData.append('description', elements.contractDescription.value.trim());
            formData.append('file', elements.contractFile.files[0]);
            
            const response = await fetch(`${API_BASE_URL}/contracts`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('token')}`
                },
                body: formData
            });
            
            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Erro ao cadastrar contrato');
            }

            showSuccessMessage('Contrato cadastrado com sucesso!');
            elements.form.reset();
            loadContracts(); // Recarrega a lista de contratos
        } catch (error) {
            showErrorMessage('Acesso restrito! Faça login para continuar.');
        } finally {
            showLoading(false);
            submitButton.disabled = false;
        }
    }

    // Clean Button - Limpar todos os contratos
    elements.cleanAllButton?.addEventListener('click', async () => {
        if (!confirm('Tem certeza que deseja apagar TODOS os contratos? Esta ação não pode ser desfeita.')) {
            showSuccessMessage('Operação cancelada pelo usuário');
            return;
        }

        try {
            showLoading(true);
                
            const response = await fetch(`${API_BASE_URL}/contracts/clean-all`, {
                method: 'DELETE',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${localStorage.getItem('token')}`
                }
            });

            const result = await response.json();

            if (!response.ok) {
                throw new Error(result.message || result.error || 'Erro ao limpar contratos');
            }

        // Atualiza a interface do usuário
        elements.documentsContainer.innerHTML = '<div class="no-results">Nenhum contrato encontrado</div>';
            showSuccessMessage('Todos os contratos foram removidos com sucesso!');
            
        // Força um reload nos dados (opcional)
        setTimeout(() => loadContracts(), 500);   

        } catch (error) {
            showErrorMessage(`Falha ao limpar contratos: ${error.message}`);
        } finally {
            showLoading(false);
        }
    });
    

    function updateContractList(contracts, page = 1) {
        const container = elements.documentsContainer;
        const CONTRACTS_PER_PAGE = 4;
        const start = (page - 1) * CONTRACTS_PER_PAGE
        const end = start + CONTRACTS_PER_PAGE;
        const contractsToShow = contracts.slice(start, end)


        if (contractsToShow.length === 0) {    
            container.innerHTML = '<div class="no-results">Nenhum contrato encontrado</div>';
        } else {
            container.innerHTML = '';
            contractsToShow.forEach(contract => {
                const contractElement = createContractElement(contract);
                container.appendChild(contractElement);
            });
        }

        renderPagination(contracts.length, page)

            // Função renderização de página
    function renderPagination(totalContracts, page) {
        const totalPages = Math.ceil(totalContracts / CONTRACTS_PER_PAGE);
        const pagination = document.querySelector('.pagination');
        pagination.innerHTML = `
        <a href="#" class="page-nav" data-page="prev"><i class="fas fa-angle-double-left"></i></a>
        ${Array.from({length: totalPages}, (_, i) => `
            <a href="#" class="page-link${i+1 === page ? ' active' : ''}" data-page="${i+1}">${i+1}</a>
        `).join('')}
        <a href="#" class="page-nav" data-page="next"><i class="fas fa-angle-double-right"></i></a>
    `;
    }

    //Evento navegação 
    document.addEventListener('click', function(e) {
        if (e.target.closest('.page-link')) {
            e.preventDefault();
            currentPage = Number(e.target.closest('.page-link').dataset.page);
            updateContractList(allContracts, currentPage);
        }
        if (e.target.closest('.page-nav')) {
            e.preventDefault();
            const nav = e.target.closest('.page-nav').dataset.page;
            const totalPages = Math.ceil(allContracts.length / CONTRACTS_PER_PAGE);
            if (nav === 'prev' && currentPage > 1) currentPage--;
            if (nav === 'next' && currentPage < totalPages) currentPage++;
            updateContractList(allContracts, currentPage);
        }
    })
}

// Atualize a função loadContracts para forçar recarregamento
async function loadContracts(filters = {}) {
    try {
        showLoading(true);
        elements.documentsContainer.innerHTML = '';
        
        const query = new URLSearchParams(filters).toString();
        const response = await fetch(`${API_BASE_URL}/contracts?${query}`, {
            headers: {
                'Authorization': `Bearer ${localStorage.getItem('token')}`
            }
        });

        if (!response.ok) throw new Error('Erro ao carregar contratos');
        
        const contracts = await response.json();

                // Ordenar por data (mais antiga primeiro)
        contracts.sort((a, b) => {
            if (!a.date) return -1;
            if (!b.date) return 1;
            return a.date.localeCompare(b.date);
        })

        allContracts = contracts;
        currentPage = 1;
        updateContractList(allContracts, currentPage);
        
    } catch (error) {
        console.error('Erro ao carregar contratos:', error);
        elements.documentsContainer.innerHTML = `
            <div class="alert alert-danger">
                Erro ao carregar contratos: ${escapeHTML(error.message)}
            </div>`;
    } finally {
        showLoading(false);
    }
}


    function createContractElement(contract) {
        const typeClass = `badge-${(contract.type || 'outro').toLowerCase().replace(/[^a-z0-9-]/g, '')}`;
        const element = document.createElement('div');
        element.className = 'document-card contracts';
        element.innerHTML = `
            <div class="document-header">
                <span class="document-type badge ${typeClass}">${escapeHTML(getContractTypeName(contract.type))}</span>
                <span class="document-number"> N° ${escapeHTML(contract.number)}</span>
            </div>
            <div class="document-body">
                <p class="document-date"><i class="far fa-calendar-alt me-2"></i>${escapeHTML(formatDisplayDate(contract.date))}</p>
                <p class="document-description">Informações: ${escapeHTML(contract.description || 'Sem descrição')}</p>
            </div>
            <div class="document-actions">
                <button class="btn-view" title="Visualizar contrato" data-id="${escapeHTML(contract.id)}">
                    <i class="fas fa-eye"></i> Visualizar
                </button>
                <button class="btn-download" title="Baixar contrato" data-id="${escapeHTML(contract.id)}">
                    <i class="fas fa-download"></i> Download
                </button>
                <button class="btn-delete" title="Excluir contrato" data-id="${escapeHTML(contract.id)}">
                    <i class="fas fa-trash"></i> Excluir
                </button>
            </div>
        `;

        // Adiciona eventos aos botões
        element.querySelector('.btn-view').addEventListener('click', () => viewContract(contract.id));
        element.querySelector('.btn-download').addEventListener('click', () => downloadContract(contract.id));
        element.querySelector('.btn-delete').addEventListener('click', () => deleteContract(contract.id));

        return element;
    }

    
    // Botão deletar contrato individuais
    async function deleteContract(id) {
        if (!confirm('Tem certeza que deseja excluir este contrato?')) return;

        try {
            showLoading(true);
            const response = await fetch(`${API_BASE_URL}/contracts/${id}`, {
                method: 'DELETE',
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('token')}`
                }
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Erro ao excluir contrato');
            }

            await loadContracts(); // Recarrega a lista de contratos
            showSuccessMessage('Contrato excluído com sucesso!');
        } catch (error) {
            showErrorMessage('Acesso restrito! Faça login para continuar.');
        } finally {
            showLoading(false);
        }
    }

    function getContractTypeName(type) {
        const types = {
            'aditivo': 'Aditivo',
            'servicos': 'Serviços',
            'fornecimento': 'Fornecimento',
            'convenio': 'Convênio',
            'outro': 'Outro'
        };
        return types[type] || type || '-';
    }

    function formatDisplayDate(dateString) {
       if (!dateString) return '';
       const [year, month, day] = dateString.split('-');
        return `${day}/${month}/${year}`;
    }

    // Visualizar contrato
async function viewContract(id) {
    let newWindow;
    try {
        showLoading(true);
        const token = localStorage.getItem('token');
        if (!token) throw new Error('Acesso restrito! Faça login para continuar.');
        newWindow = window.open('', '_blank');
        if (!newWindow) throw new Error('Permita a abertura de janelas para visualizar o contrato.');

        // Pré-carrega o PDF em segundo plano
        const preloadResponse = await fetch(`${API_BASE_URL}/contracts/${id}/view`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (!preloadResponse.ok) throw new Error('Falha ao carregar PDF');

        // Cria um blob e URL temporária
        const blob = await preloadResponse.blob();
        const pdfUrl = URL.createObjectURL(blob);

        // Abre em nova aba com a URL em cache
        newWindow.location.href = pdfUrl;

        setTimeout(() => URL.revokeObjectURL(pdfUrl), 60000);

    } catch (error) {
        showErrorMessage(error.message);
        
        newWindow?.close();
    } finally {
        showLoading(false);
    }
}

    // Download de contrato
    async function downloadContract(id) {
        if (!id) {
            throw new Error('Id do contrato não encontrado');
        }

        try {
            showLoading(true);

            const token = localStorage.getItem('token');
            if (!token) {
                throw new Error('Autenticação necessária');
            }
            
            // 1. Obter metadados do contrato
            const contractUrl = `${API_BASE_URL}/contracts/${id}`;
            console.log(`Chamando endpoint ${contractUrl}`);
            
            const contractResponse = await fetch(contractUrl, {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });

            if (!contractResponse.ok) {
                console.error('Erro na resposta:', contractResponse.status, contractResponse.statusText);
                throw new Error(contractResponse.status === 404
                    ? 'Contrato não encontrado'
                    : `Erro ao obter contrato ${contractResponse.statusText}`);
            }

            const contract = await contractResponse.json();

            // 2. Fazer download do arquivo
            const downloadUrl = `${API_BASE_URL}/contracts/${id}/download`;

            const response = await fetch(downloadUrl, {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });

            if (!response.ok) {
                throw new Error('Falha ao baixar arquivo');
            }

            // Verificar se a resposta contém dados
            const contentType = response.headers.get('content-type') || '';
            if (!contentType || response.status === 204) {
                throw new Error('Nenhum dado recebido para download');
            }

            // 3. Criar blob e URL
            const blob = await response.blob();
            const url = window.URL.createObjectURL(blob);
            
            // 4. Determinar extensão correta
            const extension = getFileExtension(contract.mimeType || contentType);
            const filename = `contrato-${contract.number}${extension}`;

            // 5. Disparar download
            downloadFile(url, filename);
            
            // 6. Limpar memória imediatamente após download
            setTimeout(() => {
                window.URL.revokeObjectURL(url);
            }, 30000);
            
        } catch (error) {
            showErrorMessage('Acesso restrito! Faça login para continuar.');
        } finally {
            showLoading(false);
        }
    }

    function downloadFile(url, filename) {
        try {
            // Cria link temporário
            const a = document.createElement('a');
            a.href = url;
            a.download = filename;
            a.style.display = 'none';
            a.rel = 'noopener noreferrer';

            // Adiciona ao DOM e dispara click
            document.body.appendChild(a);
            a.click();
            
            // Limpeza
            setTimeout(() => {
                document.body.removeChild(a);
            }, 100);
        } catch (error) {
            console.error('Erro ao iniciar download', error);
            throw new Error('Falha ao preparar download'); 
        }
    }

    function getFileExtension(contentType) {
        const extensionsMap = {
            'application/pdf': '.pdf',
            'application/msword': '.doc',
            'application/vnd.openxmlformats-officedocument.wordprocessingml.document': '.docx',
            'image/jpeg': '.jpg',
            'image/png': '.png',
            'application/vnd.ms-excel': '.xls',
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': '.xlsx',
            'text/plain': '.txt',
            'application/octet-stream': '.bin'
        };
        
        // Remove parâmetros extras (como charset)
        const cleanType = contentType?.split(';')[0].trim();
        return extensionsMap[cleanType] || extensionsMap['application/octet-stream'];
    }

    // Filtros e busca
    function setupFilters() {
        elements.filterType.addEventListener('change', () => {
            loadFilters();
        });
        
        elements.filterYear.addEventListener('change', () => {
            loadFilters();
        });
        
        elements.searchContract.addEventListener('input', debounce(() => {
            loadFilters();
        }, 300));
    }

    function loadFilters() {
        loadContracts({
            type: elements.filterType.value,
            year: elements.filterYear.value,
            search: elements.searchContract.value.trim()
        });
    }

    function debounce(func, wait) {
        let timeout;
        return function() {
            const context = this, args = arguments;
            clearTimeout(timeout);
            timeout = setTimeout(() => func.apply(context, args), wait);
        };
    }

    // Feedback visual
    function showLoading(show) {
        elements.loadingIndicator.style.display = show ? 'block' : 'none';
    }

    // Inicialização
    function init() {
        setupDateValidation();
        if (elements.form) {
            elements.form.addEventListener('submit', handleFormSubmit);
        }
        setupFilters();
        loadContracts();
    }

    init();


});
