// Configurações
const API_URL = 'http://localhost:3000/api';
const UPLOADS_DIR = 'uploads/projects/';



// Utilitários
const utils = {
  sanitize: (str) => {
    if (!str) return '';
    return str.toString()
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  },

  formatDate: (dateString) => {
    if (!dateString) return '-';
    const [year, month, day] = dateString.split('T')[0].split('-');
    return `${day}/${month}/${year}`;
  },

  getStatusText: (status) => {
    const statusTexts = {
      'planejamento': 'Planejamento',
      'andamento': 'Em andamento',
      'suspenso': 'Suspenso',
      'concluido': 'Concluído'
    };
    return statusTexts[status] || status;
  },

  debounce: (func, wait) => {
    let timeout;
    return function(...args) {
      clearTimeout(timeout);
      timeout = setTimeout(() => func.apply(this, args), wait);
    };
  }
};

document.addEventListener('DOMContentLoaded', function() {
  // Elementos DOM
  const projectMessage = document.getElementById('project-message');
  const projectForm = document.getElementById('project-form');
  const loadingProjects = document.getElementById('loading-projects');
  const projectsTable = document.createElement('div');
  projectsTable.id = 'projects-table';
  projectsTable.className = 'projects-table-container';
  document.querySelector('.pagination').before(projectsTable);

  // Logica de Páginação
  const PROJECTS_PER_PAGE = 5;
  let currentPage = 1;

  // Variáveis Globais
  let allProjects = [];
  let displayedProjects = [];
  const token = localStorage.getItem('token');
  
function renderProjectsPage(page) {
  const start = (page - 1) * PROJECTS_PER_PAGE;
  const end = start + PROJECTS_PER_PAGE;
  const projectsToShow = displayedProjects.slice(start, end);

  projectsTable.innerHTML = '';

  if (projectsToShow.length === 0) {
    projectsTable.innerHTML = '<p class="no-projects">Nenhum projeto encontrado</p>';
    renderPagination();
    return;
  }

  const table = document.createElement('table');
  table.className = 'projects-table';

  const thead = document.createElement('thead');
  thead.innerHTML = `
    <tr>
      <th>Código</th>
      <th>Nome</th>
      <th>Responsável</th>
      <th>Início</th>
      <th>Término</th>
      <th>Status</th>
      <th>Ações</th>
    </tr>
  `;
  table.appendChild(thead);

  const tbody = document.createElement('tbody');
  projectsToShow.forEach(project => {
    const row = document.createElement('tr');
    row.innerHTML = `
      <td>${utils.sanitize(project.code)}</td>
      <td>${utils.sanitize(project.name)}</td>
      <td>${utils.sanitize(project.manager)}</td>
      <td>${utils.formatDate(project.start_date)}</td>
      <td>${project.end_date ? utils.formatDate(project.end_date) : '-'}</td>
      <td><span class="status-badge ${utils.sanitize(project.status)}">${utils.getStatusText(project.status)}</span></td>
      <td class="actions">
        <button class="btn-view project" type="button" data-id="${project.id}" title="Visualizar projeto" aria-label="Visualizar projeto">${window.documentIcons.markup('eye')}</button>
        <button class="btn-edit project" type="button" data-id="${project.id}" title="Editar projeto" aria-label="Editar projeto">${window.documentIcons.markup('edit')}</button>
        <button class="btn-delete project" type="button" data-admin-only data-id="${project.id}" title="Excluir projeto" aria-label="Excluir projeto">${window.documentIcons.markup('trash')}</button>
      </td>
    `;
    tbody.appendChild(row);
  });
  table.appendChild(tbody);
  projectsTable.appendChild(table);

  addProjectActionEvents();
  renderPagination();
}
  // Função para renderizar a página
  function renderPagination() {
    const totalPages = Math.ceil(displayedProjects.length / PROJECTS_PER_PAGE)
    window.documentPagination.render(document.querySelector('.pagination'), currentPage, totalPages);
  }

  document.querySelector('.pagination')?.addEventListener('click', event => {
    const button = event.target.closest('button[data-page]');
    if (!button || button.disabled) return;
    const totalPages = Math.ceil(displayedProjects.length / PROJECTS_PER_PAGE);
    currentPage = button.dataset.page === 'prev' ? currentPage - 1
      : button.dataset.page === 'next' ? currentPage + 1 : Number(button.dataset.page);
    currentPage = Math.min(Math.max(currentPage, 1), totalPages);
    renderProjectsPage(currentPage);
  });

  // Inicialização
  initDatePickers();
  loadProjects();
  setupEventListeners();

  function initDatePickers() {
    const startDateInput = document.getElementById('project-start');
    const endDateInput = document.getElementById('project-end');
    startDateInput.setAttribute('type', 'date');
    endDateInput.setAttribute('type', 'date');
    document.getElementById('project-start').addEventListener('change', function() {
      document.getElementById('project-end').min = this.value;
    });
  }

  function setupEventListeners() {
    projectForm.addEventListener('submit', handleProjectSubmit);
    
    // Filtros com debounce para melhor performance
    document.getElementById('filter-status').addEventListener('change', filterProjects);
    document.getElementById('filter-year').addEventListener('change', filterProjects);
    document.getElementById('search-project').addEventListener(
      'input', 
      utils.debounce(filterProjects, 300)
    );
    document.querySelector('.search-btn').addEventListener('click', filterProjects);
  }

  async function handleProjectSubmit(e) {
    e.preventDefault();

    if (!validateProjectForm()) return;

    const submitBtn = projectForm.querySelector('button[type="submit"]');
    const originalBtnText = submitBtn.innerHTML;
    submitBtn.disabled = true;
    submitBtn.innerHTML = `${window.documentIcons.markup('loading', 'ui-icon is-loading')} Salvando...`;

    try {
      const formData = new FormData();
      const projectData = {
        name: document.getElementById('project-name').value.trim(),
        code: document.getElementById('project-code').value.trim(),
        manager: document.getElementById('project-manager').value.trim(),
        start_date: document.getElementById('project-start').value,
        end_date: document.getElementById('project-end').value || null,
        status: document.getElementById('project-status').value,
        description: document.getElementById('project-description').value.trim()
      };

      formData.append('project', JSON.stringify(projectData));

      const filesInput = document.getElementById('project-files');
      for (let i = 0; i < filesInput.files.length; i++) {
        formData.append('files', filesInput.files[i]);
      }

      console.log('Enviando dados do projeto:', projectData);
      const response = await fetch(`${API_URL}/projects`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        },
        body: formData
      });

      if (!response.ok) {
        throw await window.documentFeedback.requestError(response, 'Não foi possível criar o projeto.');
      }

      const data = await response.json();
      if (!data.success) throw new Error(data.message || 'Não foi possível criar o projeto.');
      projectForm.reset();
      const refreshed = await loadProjects();
      SuccessMessage(refreshed ? 'Projeto criado com sucesso!' : 'Projeto criado, mas a lista não foi atualizada. Recarregue a página.', refreshed ? 'success' : 'info');
    } catch (error) {
      ErroMessage(window.documentFeedback.errorMessage(error, 'Não foi possível criar o projeto.'), 'error');
    } finally {
      submitBtn.disabled = false;
      submitBtn.innerHTML = originalBtnText;
    }
  }

  function validateProjectForm() {
    const name = document.getElementById('project-name').value.trim();
    const code = document.getElementById('project-code').value.trim();
    const manager = document.getElementById('project-manager').value.trim();
    const startDate = document.getElementById('project-start').value;
    const description = document.getElementById('project-description').value.trim();

    // Validação básica
    if (!name || !code || !manager || !startDate || !description) {
      ErroMessage('Preencha todos os campos obrigatórios', 'error');
      return false;
    }

    // Validação de código do projeto 
    if (code.length < 3) {
      ErroMessage ('O código do projeto deve ter pelo menos 3 caracteres', 'error');
      return false;
    }

    // Validação de datas
    const start = new Date(startDate);
    const end = document.getElementById('project-end').value;
    
    if (end) {
      const endDate = new Date(end);
      if (endDate < start) {
        ErroMessage('A data de término não pode ser anterior à data de início', 'error');
        return false;
      }
    }

    return true;
  }

  async function loadProjects() {
    try {
      loadingProjects.style.display = 'block';
      projectsTable.innerHTML = '<div class="loading-content">Carregando projetos...</div>';

      const response = await fetch(`${API_URL}/projects`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        cache: 'default'
      });

      if (!response.ok) {
        if (response.status === 401 || response.status === 403) {
          sessionStorage.setItem('auth-notice', 'expired');
          localStorage.removeItem('token');
          localStorage.removeItem('userData');
          window.location.href = '/FrontEnd/login.html';
          return false;
        }
        
        throw await window.documentFeedback.requestError(response, 'Não foi possível carregar os projetos.');
      }
      
      const data = await response.json();
      allProjects = data.projects || [];

      // Ordenar por data de início mais recente primeiro
      allProjects.sort((a, b) => {
        if (!a.start_date) return 1;
        if (!b.start_date) return -1;
        return new Date(a.start_date) - new Date(b.start_date)
      });

      displayedProjects = [...allProjects];
      currentPage = Math.min(currentPage, Math.max(1, Math.ceil(displayedProjects.length / PROJECTS_PER_PAGE)));
      renderProjectsPage(currentPage);
      return true;

    } catch (error) {
      console.error('Erro ao carregar projetos:', error);
      const message = window.documentFeedback.errorMessage(error, 'Não foi possível carregar os projetos.');
      ErroMessage(message, 'error');
      projectsTable.innerHTML = `<div class="error-content">${utils.sanitize(message)}</div>`;
      return false;
    } finally {
      loadingProjects.style.display = 'none';
    }
  }

  
  function filterProjects() {
    const statusFilter = document.getElementById('filter-status').value;
    const yearFilter = document.getElementById('filter-year').value;
    const searchTerm = document.getElementById('search-project').value.toLowerCase();

    let filtered = [...allProjects];

    if (statusFilter) {
      filtered = filtered.filter(p => p.status === statusFilter);
    }

    if (yearFilter) {
      filtered = filtered.filter(p => {
        const startYear = new Date(p.start_date).getFullYear();
        return startYear.toString() === yearFilter;
      });
    }

    if (searchTerm) {
      filtered = filtered.filter(p => 
        p.name.toLowerCase().includes(searchTerm) ||
        p.code.toLowerCase().includes(searchTerm) ||
        (p.manager && p.manager.toLowerCase().includes(searchTerm))
      );
    }

    displayedProjects = filtered;
    currentPage = 1;
    renderProjectsPage(currentPage);
  }

  function addProjectActionEvents() {
    // VISUALIZAR PROJETO
    document.querySelectorAll('.btn-view').forEach(btn => {
      btn.addEventListener('click', function() {
        const projectId = this.getAttribute('data-id');
        viewProject(projectId);
      });
    });

    // Editar Projeto
    document.querySelectorAll('.btn-edit').forEach(btn => {
      btn.addEventListener('click', function() {
        const projectId = this.getAttribute('data-id');
        editProject(projectId);
      });
    });

    // Excluir Projeto 
    document.querySelectorAll('.btn-delete').forEach(btn => {
      btn.addEventListener('click', function() {
        const projectId = this.getAttribute('data-id');
        if (confirm('Tem certeza que deseja excluir este projeto? Esta ação não pode ser desfeita.')) {
          deleteProject(projectId);
        }
      });
    });
  }


  async function viewProject(projectId) {
    if (!projectId) {
        console.error('ID do projeto não fornecido')
        ErroMessage('Erro ao carregar projeto: ID não encontrado', 'error')
        return;
    }

    try {
      const response = await fetch(`${API_URL}/projects/${projectId}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      

      if (!response.ok) {
        throw await window.documentFeedback.requestError(response, 'Não foi possível carregar o projeto.');
      }

      const data = await response.json();
      const project = data.project || data;
      if (!project || !project.name) {
        throw new Error('Projeto não encontrado ou resposta inválida');
      }
      showProjectDetails(data.project);
    } catch (error) {
      console.error('Erro ao visualizar projeto:', error);
      ErroMessage(window.documentFeedback.errorMessage(error, 'Não foi possível carregar o projeto.'));
    }
  }


  function showProjectDetails(project) {
    if (!project || !project.name) {
      ErroMessage('Erro ao carregar detalhes do projeto', 'error');
      return;
    }
    const modal = document.createElement('div');
    modal.className = 'project-modal';
    modal.innerHTML = `
      <div class="modal-content">
        <button type="button" class="close-modal" aria-label="Fechar detalhes">&times;</button>
        <h3> ${utils.sanitize(project.name)} - <span class="status-badge ${utils.sanitize(project.status)}">${utils.getStatusText(project.status)}</span></h3>
        
        <div class="project-details">
          <div class="detail-row">
            <span class="detail-label">Código:</span>
            <span class="detail-value">${utils.sanitize(project.code)}</span>
          </div>
          <div class="detail-row">
            <span class="detail-label">Responsável:</span>
            <span class="detail-value">${utils.sanitize(project.manager)}</span>
          </div>
          <div class="detail-row">
            <span class="detail-label">Data de Início:</span>
            <span class="detail-value">${utils.formatDate(project.start_date)}</span>
          </div>
          <div class="detail-row">
            <span class="detail-label">Previsão de Término:</span>
            <span class="detail-value">${project.end_date ? utils.formatDate(project.end_date) : 'Não definida'}</span>
          </div>
          <div class="detail-row">
            <span class="detail-label">Descrição:</span>
            <p class="detail-value">${utils.sanitize(project.description)}</p>
          </div>
          
          ${project.files && project.files.length > 0 ? `
            <div class="detail-row">
              <span class="detail-label">Documentos:</span>
              <div class="files-container">
                ${project.files.map(file => {
                  const ext = file.filename.split('.').pop().toLowerCase();
                  const fileUrl = `${API_URL}/project-files/${encodeURIComponent(file.filename)}`;
                  return `
                  <div class="file-item" data-file-id="${file._id || file.id}">
                    <div class="file-info">
                      ${window.documentIcons.markup(ext === 'pdf' ? 'file' : 'image')}
                      <a href="#" class="project-file-link" data-file-url="${fileUrl}" data-filename="${utils.sanitize(file.originalname)}">${utils.sanitize(file.originalname)}</a>
                      <span class="file-size">(${formatFileSize(file.size)})</span>
                    </div>
                    <div class="file-actions">
                      <button class="btn-download-file" type="button" data-file-url="${fileUrl}" data-filename="${utils.sanitize(file.originalname)}" title="Baixar arquivo" aria-label="Baixar arquivo">
                        ${window.documentIcons.markup('download')}
                      </button>
                      <button class="btn-delete-file" type="button" data-admin-only data-file-id="${file._id || file.id}" data-project-id="${project.id}" title="Excluir o arquivo" aria-label="Excluir o arquivo">
                        ${window.documentIcons.markup('trash')}
                      </button>
                    </div>
                  </div>`;
                }).join('')}
              </div>
            </div>
          ` : ''}
        </div>
      </div>
    `;
    
    modal.classList.add('active');
    document.body.appendChild(modal);

    // Fechamento do modal
    modal.querySelector('.close-modal').addEventListener('click', () => {
      modal.remove();
    });

    modal.addEventListener('click', (e) => {
      if (e.target === modal) {
        modal.remove();
      }
    });

    modal.querySelectorAll('.project-file-link').forEach(link => {
      link.addEventListener('click', (e) => {
        e.preventDefault();
        viewFile(link.dataset.fileUrl, link.dataset.filename);
      });
    });

    // Download de arquivos
    modal.querySelectorAll('.btn-download-file').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const fileUrl = e.currentTarget.dataset.fileUrl;
        const fileName = e.currentTarget.dataset.filename;
        downloadFile(fileUrl, fileName);
      });
    });

    // Exclusão de arquivos
    modal.querySelectorAll('.btn-delete-file').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const fileId = e.currentTarget.dataset.fileId;
        const projectId = e.currentTarget.dataset.projectId;
        deleteFile(fileId, projectId);
      });
    });
  }

  function formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  async function getProjectFile(url) {
    const response = await fetch(url, {
      headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
    });
    if (!response.ok) throw new Error('Não foi possível carregar o arquivo');
    return response.blob();
  }

  function saveBlob(blob, filename) {
    const blobUrl = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = blobUrl;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(blobUrl), 30000);
  }

  async function viewFile(url, filename) {
    const newWindow = window.open('', '_blank');
    try {
      const blob = await getProjectFile(url);
      if (newWindow && (blob.type === 'application/pdf' || blob.type.startsWith('image/'))) {
        const blobUrl = URL.createObjectURL(blob);
        newWindow.location.href = blobUrl;
        setTimeout(() => URL.revokeObjectURL(blobUrl), 60000);
      } else {
        newWindow?.close();
        saveBlob(blob, filename);
      }
    } catch (error) {
      newWindow?.close();
      ErroMessage(error.message, 'error');
    }
  }

  async function downloadFile(url, filename) {
    if (!url || !filename) {
        console.error('Dados inválidos para download:', {url, filename});
        ErroMessage('Erro ao preparar download: dados incompletos', 'error')
        return;
    }

    try {
    saveBlob(await getProjectFile(url), filename);
  } catch (error) {
    console.error('Erro ao baixar arquivo:', error)
    ErroMessage('Erro ao baixar arquivo. Tente novamente')
  }
}

  async function deleteFile(fileId, projectId) {
    if (!fileId || !projectId) {
        console.error('IDs inválidos:', {fileId, projectId});
        ErroMessage('Não foi possível identificar o arquivo para exclusão.', 'error');
        return
    }

    if (!confirm('Tem certeza que deseja excluir este arquivo?')) {
      return;
    }

    try {
      const response = await fetch(`${API_URL}/project-files/${fileId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Erro ao excluir arquivo') 
      }

      SuccessMessage('Arquivo excluído com sucesso!', 'success');
        await viewProject(projectId);

    } catch (error) {
      console.error('Erro ao excluir arquivo:', error);
      ErroMessage(error.message, 'error');
    }
  }

  async function editProject(projectId) {
    let editBtn;
    let originalContent;
    try {
      // Mostrar loader
      editBtn = document.querySelector(`.btn-edit[data-id="${projectId}"]`);
      originalContent = editBtn.innerHTML;
      editBtn.innerHTML = window.documentIcons.markup('loading', 'ui-icon is-loading');
      editBtn.disabled = true;

      // Carrega os dados do projeto
      const response = await fetch(`${API_URL}/projects/${projectId}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!response.ok) {
        throw await window.documentFeedback.requestError(response, 'Não foi possível carregar o projeto para edição.');
      }

      const data = await response.json();

      // Preenche o formulário com os dados do projeto
      const project = data.project;
      document.getElementById('project-name').value = project.name;
      document.getElementById('project-code').value = project.code;
      document.getElementById('project-manager').value = project.manager;
      document.getElementById('project-start').value = project.start_date.split('T')[0];
      document.getElementById('project-end').value = project.end_date ? project.end_date.split('T')[0] : '';
      document.getElementById('project-status').value = project.status;
      document.getElementById('project-description').value = project.description;
      
      // Rola até o formulário
      document.getElementById('project-form').scrollIntoView({ behavior: 'smooth' });

      // Altera o botão de submit para "Atualizar"
      const submitBtn = projectForm.querySelector('button[type="submit"]');
      submitBtn.innerHTML = `${window.documentIcons.markup('save')} Atualizar projeto`;
      submitBtn.dataset.editing = projectId;
      submitBtn.classList.add('btn-update');
      
      SuccessMessage('Preencha os campos que deseja alterar!', 'info');

      // Remove o evento antigo e adiciona o novo
      projectForm.removeEventListener('submit', handleProjectSubmit);
      projectForm.addEventListener('submit', handleProjectUpdate);

      
    } catch (error) {
      console.error('Erro ao editar projeto', error);
      ErroMessage(window.documentFeedback.errorMessage(error, 'Não foi possível editar o projeto.'));
    } finally {
      if (editBtn) {
        editBtn.innerHTML = originalContent;
        editBtn.disabled = false;
      }
    }
  }

  async function handleProjectUpdate(e) {
    e.preventDefault();
    
    const projectId = e.target.querySelector('button[type="submit"]').dataset.editing;
    const submitBtn = e.target.querySelector('button[type="submit"]');
    const originalBtnText = submitBtn.innerHTML;
    let updated = false;
    
    try {
      submitBtn.disabled = true;
      submitBtn.innerHTML = `${window.documentIcons.markup('loading', 'ui-icon is-loading')} Atualizando...`;

      const formData = new FormData();
      const projectData = {
        name: document.getElementById('project-name').value.trim(),
        code: document.getElementById('project-code').value.trim(),
        manager: document.getElementById('project-manager').value.trim(),
        start_date: document.getElementById('project-start').value,
        end_date: document.getElementById('project-end').value || null,
        status: document.getElementById('project-status').value,
        description: document.getElementById('project-description').value.trim()
      };
      
      formData.append('project', JSON.stringify(projectData));
      
      const filesInput = document.getElementById('project-files');
      for (let i = 0; i < filesInput.files.length; i++) {
        formData.append('files', filesInput.files[i]);
      }
      
      const response = await fetch(`${API_URL}/projects/${projectId}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`
        },
        body: formData
      });
      
      if (!response.ok) {
        throw await window.documentFeedback.requestError(response, 'Não foi possível atualizar o projeto.');
      }

      const data = await response.json();
      if (!data.success) throw new Error(data.message || 'Não foi possível atualizar o projeto.');
      console.log('Projeto atualizado:', data);
      updated = true;
      // Limpa o formulário
      projectForm.reset();
      const refreshed = await loadProjects();
      
      // Exibe mensagem de sucesso
      SuccessMessage(refreshed ? 'Projeto atualizado com sucesso!' : 'Projeto atualizado, mas a lista não foi atualizada. Recarregue a página.', refreshed ? 'success' : 'info');

      // Restaura o formulário para modo de criação
      submitBtn.innerHTML = `${window.documentIcons.markup('save')} Salvar projeto`;
      delete submitBtn.dataset.editing;
      submitBtn.classList.remove('btn-update');


      
      projectForm.removeEventListener('submit', handleProjectUpdate);
      projectForm.addEventListener('submit', handleProjectSubmit);
    } catch (error) {
      console.error('Erro ao atualizar projeto:', error);
      ErroMessage(window.documentFeedback.errorMessage(error, 'Não foi possível atualizar o projeto.'), 'error');
    } finally {
      submitBtn.disabled = false;
      submitBtn.innerHTML = updated ? `${window.documentIcons.markup('save')} Salvar projeto` : originalBtnText;
    }
  }

  async function deleteProject(projectId) {
    const deleteBtn = document.querySelector(`.btn-delete[data-id="${projectId}"]`);
    const originalContent = deleteBtn?.innerHTML;
    try {
      if (deleteBtn) {
        deleteBtn.innerHTML = window.documentIcons.markup('loading', 'ui-icon is-loading');
        deleteBtn.disabled = true;
      }

      const response = await fetch(`${API_URL}/projects/${projectId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!response.ok) {
        throw await window.documentFeedback.requestError(response, 'Não foi possível excluir o projeto.');
      }

      const refreshed = await loadProjects();
      SuccessMessage(refreshed ? 'Projeto excluído com sucesso!' : 'Projeto excluído, mas a lista não foi atualizada. Recarregue a página.', refreshed ? 'success' : 'info');
    } catch (error) {
      console.error('Erro ao excluir projeto:', error);
      ErroMessage(window.documentFeedback.errorMessage(error, 'Não foi possível excluir o projeto.'), 'error');
    } finally {
      if (deleteBtn?.isConnected) {
        deleteBtn.innerHTML = originalContent;
        deleteBtn.disabled = false;
      }
    }
  }


  function ErroMessage(message, type) {
    window.documentFeedback.show(projectMessage, message, 'error');
  }


  function SuccessMessage(message, type) {
    window.documentFeedback.show(projectMessage, message, type === 'info' ? 'info' : 'success');
  }
});
