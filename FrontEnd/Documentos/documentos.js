// document.addEventListener('DOMContentLoaded', function() {

// // Configurações globais
// const API_BASE_URL = 'http://localhost:3000';
// const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
// const ALLOWED_FILE_TYPES = [
//     'application/pdf',
//     'image/jpeg',
//     'image/png',
//     'application/msword',
//     'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
// ];


//     // Estado da aplicação
//     const state = {
//         authToken: localStorage.getItem('jwtToken') || '',
//         currentContracts: []
//     };

//     // Utilitários
//     const utils = {
//         showMessage: (message, type = 'success') => {
//             elements.uploadMessage.innerHTML = message;
//             elements.uploadMessage.className = `message ${type}`;
//             elements.uploadMessage.style.display = 'block';
//             setTimeout(() => {
//                 elements.uploadMessage.style.display = 'none';
//             }, 5000);
//         },

//         getTypeName: (type) => {
//             const typeNames = {
//                 'aditivo': 'Aditivo Contratual',
//                 'servicos': 'Prestação de Serviços',
//                 'fornecimento': 'Fornecimento de Materiais',
//                 'convenio': 'Termo de Convênio',
//                 'outro': 'Outro'
//             };
//             return typeNames[type] || type;
//         },

//         formatDate: (dateString) => {
//             try {
//                 const date = new Date(dateString);
//                 return date.toLocaleDateString('pt-BR');
//             } catch {
//                 return 'Data inválida';
//             }
//         },

//         validateFile: (file) => {
//             if (!file) return 'Nenhum arquivo selecionado';
//             if (file.size > MAX_FILE_SIZE) return 'O arquivo deve ter no máximo 5MB';
//             if (!ALLOWED_FILE_TYPES.includes(file.type)) {
//                 return 'Tipo de arquivo inválido. Use PDF, JPG, PNG, DOC ou DOCX';
//             }
//             return null;
//         },

//         handleApiError: async (response) => {
//             if (response.status === 401) {
//                 localStorage.removeItem('jwtToken');
//                 window.location.href = '../login.html';
//                 return 'Sessão expirada. Redirecionando para login...';
//             }

//             try {
//                 const errorData = await response.json();
//                 return errorData.message || `Erro: ${response.statusText}`;
//             } catch {
//                 return `Erro: ${response.statusText}`;
//             }
//         }
//     };

//     // API Client
//     const api = {
//         request: async (endpoint, options = {}) => {
//             const config = {
//                 method: 'GET',
//                 ...options,
//                 headers: {
//                     'Authorization': `Bearer ${state.authToken}`,
//                     ...(options.headers || {})
//                 }
//             };

//             if (options.body instanceof FormData) {
//                 delete config.headers ['Content-Type'];
//             }

//         const response = await fetch(`${API_BASE_URL}${endpoint}`, config);
            
//             if (!response.ok) {
//                 const errorMessage = await utils.handleApiError(response);
//                 throw new Error(errorMessage);
//             }
            
//                 // Verifica o tipo de conteúdo
//         const contentType = response.headers.get('Content-Type');
//             if (!contentType || !contentType.includes('application/json')) {
//                 return await response.blob().catch(() => response.text());
//             }

//             return await response.json();
//         },

//         getContracts: async (filters = {}) => {
//             const params = new URLSearchParams();
//             Object.entries(filters).forEach(([key, value]) => {
//                 if (value) params.append(key, value);
//             });

//             return api.request(`/api/contracts?${params.toString()}`);
//         },

//         uploadContract: async (formData) => {
//             return api.request('/api/contracts', {
//                 method: 'POST',
//                 body: formData
//             });
//         },

//         deleteContract: async (id) => {
//             return api.request(`/api/contracts/${id}`, {
//                 method: 'DELETE'
//             });
//         },

//         downloadContract: async (id) => {
//             const response = await fetch(`${API_BASE_URL}/api/contracts/${id}/download`, {
//                 headers: {
//                     'Authorization': `Bearer ${state.authToken}`
//                 }
//             })
//             if (!response.ok) throw new Error('Falha no download');
//             return response.blob();
//         }
//     };

//     // Renderização
//     const render = {
//         contracts: (contracts) => {
//             if (!contracts || contracts.length === 0) {
//                 elements.documentsContainer.innerHTML = `
//                     <div class="empty-state">
//                         <i class="fas fa-file-circle-exclamation"></i>
//                         <p>Nenhum contrato cadastrado ainda</p>
//                     </div>
//                 `;
//                 return;
//             }

          
//             elements.documentsContainer.innerHTML = contracts.map(contract => `
//                 <div class="document-card" data-id="${contract.id}">
//                     <div class="document-header">
//                         <span class="document-type ${contract.type}">
//                             ${utils.getTypeName(contract.type)}
//                         </span>
//                         <span class="document-number">${contract.number}</span>
//                     </div>
//                     <div class="document-body">
//                         <div class="document-info">
//                             <p><strong>Data:</strong> ${utils.formatDate(contract.date)}</p>
//                             <p><strong>Descrição:</strong> 
//                                 ${contract.description.substring(0, 100)}
//                                 ${contract.description.length > 100 ? '...' : ''}
//                             </p>
//                         </div>
//                         <div class="document-actions">
//                             <button class="btn-view" data-id="${contract.id}">
//                                 <i class="fas fa-eye"></i> Visualizar
//                             </button>
//                             <button class="btn-download" data-id="${contract.id}">
//                                 <i class="fas fa-download"></i> Baixar
//                             </button>
//                             <button class="btn-delete" data-id="${contract.id}">
//                                 <i class="fas fa-trash"></i> Excluir
//                             </button>
//                         </div>
//                     </div>
//                 </div>
//             `).join('');

//             // Adiciona event listeners aos botões
//             document.querySelectorAll('.btn-view').forEach(btn => {
//                 btn.addEventListener('click', () => viewContract(btn.dataset.id));
//             });

//             document.querySelectorAll('.btn-download').forEach(btn => {
//                 btn.addEventListener('click', () => downloadContract(btn.dataset.id));
//             });

//             document.querySelectorAll('.btn-delete').forEach(btn => {
//                 btn.addEventListener('click', () => deleteContract(btn.dataset.id));
//             });
//         }
//     };

//     // Funções principais
//     async function loadContracts() {
//         try {
//             const data = await api.getContracts();
//             render.contracts(data.data || [])
//         } catch (error) {
//             utils.showMessage('Erro ao carregar contratos', + error.message, 'error');
//         }
//     }

//         document.addEventListener('DOMContentLoaded', () => {
//             loadContracts();
//         });

//     const viewContract = async (id) => {
//         try {
//             const contract = state.currentContracts.find(c => c.id === id);
//             if (!contract) throw new Error('Contrato não encontrado');
            
//             // Implemente um modal ou outra forma de visualização
//             console.log('Visualizando contrato:', contract);
//             alert(`Visualizando contrato: ${contract.number}`);
//         } catch (error) {
//             utils.showMessage(error.message, 'error');
//         }
//     };

//     const downloadContract = async (id) => {
//         try {
//             const contract = state.currentContracts.find(c => c.id === id);
//             if (!contract) throw new Error('Contrato não encontrado');
            
//             const blob = await api.downloadContract(id);
//             const url = window.URL.createObjectURL(blob);
//             const a = document.createElement('a');
//             a.href = url;
//             a.download = contract.fileName || `contrato-${id}.pdf`;
//             document.body.appendChild(a);
//             a.click();
//             document.body.removeChild(a);
//             window.URL.revokeObjectURL(url);
//         } catch (error) {
//             utils.showMessage(error.message, 'error');
//         }
//     };

//     const deleteContract = async (id) => {
//         if (!confirm('Tem certeza que deseja excluir este contrato?')) return;
        
//         try {
//             await api.deleteContract(id);
//             utils.showMessage('Contrato excluído com sucesso!');
//             loadContracts();
//         } catch (error) {
//             utils.showMessage(error.message, 'error');
//         }
//     };

//     // Inicialização safe
//     const init = () => {
//         // Event listeners
//         const essentialElements = [elements.form, elements.documentsContainer];
//         if (essentialElements.some(el => !el)) {
//             console.error('Elementos do formulário não encontrados', {
//                 form: !!elements.form,
//                 container: !!elements.documentsContainer
//             });
//             return;
//         }
           
//         if (!state.authToken) {
//             window.location.href = '../login.html'
//             return;
//         }

//         const setupListener = (element, event, handler) => {
//             if (element) {
//                 element.addEventListener(event, handler);
//             } else {
//                 console.warn(`Elemento não encontrado para evento ${event}`);
//             }
//         };

//         setupListener(element.form, 'submit', async(e) => {
//             e.preventDefault();

//         init();

//         // VALIDAÇÃO DO ARQUIVO
//         const fileError = utils.validateFile(elements.contractFile.files[0])
//         if(fileError) {
//             utils.showMessage(fileError, 'error');
//             return;
//         }

//         // VALIDA DOS CAMPOS
//         const errors = [];
//         if (!elements.contractType.value) errors.push('Tipo de contrato é obrigatório');
//         if (!elements.contractNumber.value) errors.push('Número de contrato é obrigatório');
//         if (!elements.contractDate.value) errors.push('Data do contrato é obrigatória');

//         if (errors.length > 0) {
//             utils.showMessage(errors.join('<br>'), 'error');
//             return;
//         }

//         try {
//             elements.loadingIndicator.style.display = 'block';

//             const formData = new formData();
//             formData.append('type', elements.contractType.value);
//             formData.append('number', elements.contractNumber.value);
//             formData.append('date', elements.contractDate.value);
//             formData.append('description', elements.contractDescription.value);
//             formData.append('file', elements.contractFile.files[0]);
            
//             await api.uploadContract(formData);
//             utils.showMessage('Contrato cadastrado com sucesso!');
//             elements.form.reset();
//             loadContracts();
//         } catch (error) {
//             utils.showMessage(error.message, 'error');
//         } finally {
//             elements.loadingIndicator.style.display = 'none';
//         }
//     });


//             setupListener(elements.form, 'submit', handleFormSubmit);
//             setupListener(elements.filterType, 'change', loadContracts);
//             setupListener(elements.searchContract, 'input', loadContracts);

//             loadContracts();
// };



// const menuToggle = document.getElementById("menuToggle");
// const sidebar = document.getElementById("sidebar");

// if (menuToggle && sidebar) {
//     menuToggle.addEventListener("click", () => {
//         sidebar.classList.toggle("closed");
//         menuToggle.textContent = sidebar.classList.contains("closed") ? "☰" : "✕"
// });
// } else {
//     console.error('Elementos do menu não encontrados');
// }

// })

// // Active dentro dos links para ficar fixado(marcado), como = "CONTRATO" "PROJETOS" "DOCUMENTOS" "IDENTIDADES" "OUTROS" !!!
// document.addEventListener('DOMContentLoaded', function() {
//     const currentPage = window.location.pathname.split('/').pop();
//     const navLinks = document.querySelectorAll('.nav-link');
    
//     navLinks.forEach(link => {
//         const linkPage = link.getAttribute('href').split('/').pop();
//         if (linkPage === currentPage) {
//             const navItem = link.closest('.nav-item')
//             if (navItem) {
//                 navItem.classList.add('active')
//             }
//         }
//     });
// });
