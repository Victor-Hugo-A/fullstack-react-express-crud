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

  getStatusClass: (status) => ({
    planejamento: 'planejamento',
    andamento: 'andamento',
    suspenso: 'suspenso',
    concluido: 'concluido'
  }[status] || ''),

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
  const PROJECTS_PER_PAGE = 6;
  let currentPage = 1;

  // Variáveis Globais
  let allProjects = [];
  let displayedProjects = [];
  const token = sessionStorage.getItem('portal-session');
  
function renderProjectsPage(page) {
  const start = (page - 1) * PROJECTS_PER_PAGE;
  const end = start + PROJECTS_PER_PAGE;
  const projectsToShow = displayedProjects.slice(start, end);

  projectsTable.innerHTML = '';

  if (projectsToShow.length === 0) {
    projectsTable.innerHTML = `
      <div class="no-projects" role="status">
        <span class="no-projects-icon" aria-hidden="true">${window.documentIcons.markup('search')}</span>
        <strong>Nenhum projeto encontrado</strong>
        <span>Altere ou limpe os filtros para consultar outros projetos.</span>
        <button class="btn-clear-empty-state" type="button">Limpar filtros</button>
      </div>`;
    projectsTable.querySelector('.btn-clear-empty-state').addEventListener('click', clearProjectFilters);
    renderPagination();
    return;
  }

  const table = document.createElement('table');
  table.className = 'projects-table';
  const caption = document.createElement('caption');
  caption.className = 'visually-hidden';
  caption.textContent = 'Projetos cadastrados. Use os botões de ação para visualizar, editar ou excluir cada projeto.';
  table.appendChild(caption);

  const thead = document.createElement('thead');
  thead.innerHTML = `
    <tr>
      <th scope="col">Código</th>
      <th scope="col">Projeto</th>
      <th scope="col">Responsável</th>
      <th scope="col">Início</th>
      <th scope="col">Término previsto</th>
      <th scope="col">Status</th>
      <th scope="col">Ações</th>
    </tr>
  `;
  table.appendChild(thead);

  const tbody = document.createElement('tbody');
  projectsToShow.forEach(project => {
    const row = document.createElement('tr');
    row.innerHTML = `
      <td class="project-code-cell">${utils.sanitize(project.code)}</td>
      <th scope="row" class="project-name-cell">${utils.sanitize(project.name)}</th>
      <td>${utils.sanitize(project.manager)}</td>
      <td class="project-date-cell">${utils.formatDate(project.start_date)}</td>
      <td class="project-date-cell">${project.end_date ? utils.formatDate(project.end_date) : 'Não definida'}</td>
      <td><span class="status-badge ${utils.getStatusClass(project.status)}">${utils.sanitize(utils.getStatusText(project.status))}</span></td>
      <td class="actions">
        <button class="btn-view project" type="button" data-id="${utils.sanitize(project.id)}" title="Visualizar projeto" aria-label="Visualizar ${utils.sanitize(project.name)}">${window.documentIcons.markup('eye')}<span>Ver</span></button>
        <button class="btn-edit project" type="button" data-id="${utils.sanitize(project.id)}" title="Editar projeto" aria-label="Editar ${utils.sanitize(project.name)}">${window.documentIcons.markup('edit')}<span>Editar</span></button>
        <button class="btn-delete project" type="button" data-admin-only data-id="${utils.sanitize(project.id)}" title="Excluir projeto" aria-label="Excluir ${utils.sanitize(project.name)}">${window.documentIcons.markup('trash')}<span>Excluir</span></button>
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
    document.getElementById('filter-start-date').addEventListener('change', filterProjects);
    document.getElementById('filter-end-date').addEventListener('change', filterProjects);
    document.getElementById('search-project').addEventListener(
      'input', 
      utils.debounce(filterProjects, 300)
    );
    document.querySelector('.search-btn').addEventListener('click', filterProjects);
    document.getElementById('clear-project-filters').addEventListener('click', clearProjectFilters);
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
        if (response.status === 401) {
          sessionStorage.setItem('auth-notice', 'expired');
          sessionStorage.removeItem('portal-session');
          sessionStorage.removeItem('userData');
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
    const startDateFilter = document.getElementById('filter-start-date').value;
    const endDateFilter = document.getElementById('filter-end-date').value;
    const searchTerm = document.getElementById('search-project').value.toLowerCase();

    let filtered = [...allProjects];

    if (statusFilter) {
      filtered = filtered.filter(p => p.status === statusFilter);
    }

    if (yearFilter) {
      filtered = filtered.filter(p => {
        return String(p.start_date || '').slice(0, 4) === yearFilter;
      });
    }

    if (startDateFilter) {
      filtered = filtered.filter(project => String(project.start_date || '').slice(0, 10) >= startDateFilter);
    }

    if (endDateFilter) {
      filtered = filtered.filter(project => {
        const projectEndDate = String(project.end_date || '').slice(0, 10);
        return projectEndDate && projectEndDate <= endDateFilter;
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

  function clearProjectFilters() {
    document.getElementById('filter-status').value = '';
    document.getElementById('filter-year').value = '';
    document.getElementById('filter-start-date').value = '';
    document.getElementById('filter-end-date').value = '';
    document.getElementById('search-project').value = '';
    filterProjects();
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
      btn.addEventListener('click', async function() {
        const projectId = this.getAttribute('data-id');
        const confirmed = await window.documentFeedback.confirm({
          title: 'Excluir projeto?',
          message: 'O projeto e todos os arquivos relacionados serão removidos permanentemente.',
          confirmLabel: 'Excluir projeto'
        });
        if (confirmed) {
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
    document.querySelector('.project-modal .close-modal')?.click();
    const previousFocus = document.activeElement;
    const modal = document.createElement('div');
    modal.className = 'project-modal';
    modal.innerHTML = `
      <section class="modal-content" role="dialog" aria-modal="true" aria-labelledby="project-modal-title" tabindex="-1">
        <header class="project-modal-header">
          <div class="project-modal-heading">
            <span class="project-modal-eyebrow">DETALHES DO PROJETO</span>
            <h2 id="project-modal-title">${utils.sanitize(project.name)}</h2>
            <span class="project-modal-code">Código ${utils.sanitize(project.code)}</span>
          </div>
          <button type="button" class="close-modal" aria-label="Fechar detalhes do projeto">&times;</button>
        </header>
        <div class="project-modal-body">
          <div class="project-modal-status"><span class="detail-label">Situação</span><span class="status-badge ${utils.getStatusClass(project.status)}">${utils.sanitize(utils.getStatusText(project.status))}</span></div>
          <dl class="project-details">
            <div class="detail-row">
              <dt class="detail-label">Responsável</dt>
              <dd class="detail-value">${utils.sanitize(project.manager) || 'Não informado'}</dd>
            </div>
            <div class="detail-row">
              <dt class="detail-label">Data de início</dt>
              <dd class="detail-value">${utils.formatDate(project.start_date)}</dd>
            </div>
            <div class="detail-row">
              <dt class="detail-label">Término previsto</dt>
              <dd class="detail-value">${project.end_date ? utils.formatDate(project.end_date) : 'Não definida'}</dd>
            </div>
          </dl>
          <section class="project-description-section" aria-labelledby="project-description-title">
            <h3 id="project-description-title">Descrição</h3>
            <p>${utils.sanitize(project.description) || 'Nenhuma descrição informada.'}</p>
          </section>
          ${Array.isArray(project.files) && project.files.length > 0 ? `
            <section class="project-files-section" aria-labelledby="project-files-title">
              <div class="project-files-heading">
                <h3 id="project-files-title">Documentos relacionados</h3>
                <span>${project.files.length} ${project.files.length === 1 ? 'arquivo' : 'arquivos'}</span>
              </div>
              <div class="files-container">
                ${project.files.map(file => {
                  const filename = String(file.filename || '');
                  const originalname = String(file.originalname || filename || 'Arquivo');
                  const ext = filename.split('.').pop().toLowerCase();
                  const fileUrl = `${API_URL}/project-files/${encodeURIComponent(filename)}`;
                  return `
                  <div class="file-item" data-file-id="${utils.sanitize(file._id || file.id)}">
                    <div class="file-info">
                      ${window.documentIcons.markup(ext === 'pdf' ? 'file' : 'image')}
                      <a href="#" class="project-file-link" data-file-url="${fileUrl}" data-filename="${utils.sanitize(originalname)}">${utils.sanitize(originalname)}</a>
                      <span class="file-size">${formatFileSize(file.size)}</span>
                    </div>
                    <div class="file-actions">
                      <button class="btn-download-file" type="button" data-file-url="${fileUrl}" data-filename="${utils.sanitize(originalname)}" title="Baixar arquivo" aria-label="Baixar ${utils.sanitize(originalname)}">
                        ${window.documentIcons.markup('download')}
                      </button>
                      <button class="btn-delete-file" type="button" data-admin-only data-file-id="${utils.sanitize(file._id || file.id)}" data-project-id="${utils.sanitize(project.id)}" data-filename="${utils.sanitize(originalname)}" title="Excluir o arquivo" aria-label="Excluir ${utils.sanitize(originalname)}">
                        ${window.documentIcons.markup('trash')}
                      </button>
                    </div>
                  </div>`;
                }).join('')}
              </div>
            </section>
          ` : `
            <section class="project-files-section project-files-empty" aria-labelledby="project-files-title">
              <div class="project-files-heading">
                <h3 id="project-files-title">Documentos relacionados</h3>
              </div>
              <p>Nenhum documento anexado a este projeto.</p>
            </section>
          `}
        </div>
      </section>
    `;
    
    modal.classList.add('active');
    document.body.appendChild(modal);
    const closeButton = modal.querySelector('.close-modal');
    const closeModal = () => {
      document.removeEventListener('keydown', handleModalKeydown);
      modal.remove();
      document.body.classList.remove('project-modal-open');
      if (previousFocus instanceof HTMLElement && previousFocus.isConnected) previousFocus.focus();
    };
    const handleModalKeydown = event => {
      if (event.key === 'Escape') {
        closeModal();
        return;
      }
      if (event.key !== 'Tab') return;
      const focusable = [...modal.querySelectorAll('a[href], button:not([disabled]), [tabindex="0"]')]
        .filter(element => !element.hidden && element.getAttribute('aria-hidden') !== 'true' && element.getClientRects().length > 0);
      if (focusable.length === 0) {
        event.preventDefault();
        modal.querySelector('.modal-content').focus();
      } else if (event.shiftKey && document.activeElement === focusable[0]) {
        event.preventDefault();
        focusable[focusable.length - 1].focus();
      } else if (!event.shiftKey && document.activeElement === focusable[focusable.length - 1]) {
        event.preventDefault();
        focusable[0].focus();
      }
    };
    document.addEventListener('keydown', handleModalKeydown);
    document.body.classList.add('project-modal-open');
    modal.querySelector('.modal-content').focus();

    // Fechamento do modal
    closeButton.addEventListener('click', closeModal);

    modal.addEventListener('click', (e) => {
      if (e.target === modal) {
        closeModal();
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
      btn.addEventListener('click', async (e) => {
        const fileId = e.currentTarget.dataset.fileId;
        const projectId = e.currentTarget.dataset.projectId;
        const filename = e.currentTarget.dataset.filename;
        const confirmed = await window.documentFeedback.confirm({
          title: 'Excluir arquivo?',
          message: filename
            ? `O arquivo “${filename}” será removido permanentemente do projeto.`
            : 'Este arquivo será removido permanentemente do projeto.',
          confirmLabel: 'Excluir arquivo'
        });
        if (confirmed) deleteFile(fileId, projectId);
      });
    });
  }

  function formatFileSize(bytes) {
    const size = Number(bytes);
    if (!Number.isFinite(size) || size < 0) return 'Tamanho indisponível';
    if (size === 0) return '0 bytes';
    const k = 1024;
    const sizes = ['bytes', 'KB', 'MB', 'GB'];
    const i = Math.min(Math.floor(Math.log(size) / Math.log(k)), sizes.length - 1);
    const value = size / Math.pow(k, i);
    return `${Number(value.toFixed(2))} ${sizes[i]}`;
  }

  async function getProjectFile(url) {
    const response = await fetch(url, {
      headers: { Authorization: `Bearer ${sessionStorage.getItem('portal-session')}` }
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
    const editBtn = document.querySelector(`.btn-edit[data-id="${projectId}"]`);
    const originalContent = editBtn?.innerHTML;
    try {
      if (editBtn) {
        editBtn.innerHTML = window.documentIcons.markup('loading', 'ui-icon is-loading');
        editBtn.disabled = true;
      }
      const response = await fetch(`${API_URL}/projects/${projectId}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!response.ok) throw await window.documentFeedback.requestError(response, 'Não foi possível carregar o projeto para edição.');

      const data = await response.json();
      if (!data.project?.id) throw new Error('Projeto não encontrado.');
      showProjectEditor(data.project, editBtn);
    } catch (error) {
      console.error('Erro ao editar projeto:', error);
      ErroMessage(window.documentFeedback.errorMessage(error, 'Não foi possível abrir a edição do projeto.'));
    } finally {
      if (editBtn?.isConnected) {
        editBtn.innerHTML = originalContent;
        editBtn.disabled = false;
      }
    }
  }

  function showProjectEditor(project, trigger) {
    document.querySelector('.project-modal .close-modal')?.click();
    const previousFocus = trigger || document.activeElement;
    const dateValue = value => value ? String(value).split('T')[0] : '';
    const selected = value => project.status === value ? ' selected' : '';
    const modal = document.createElement('div');
    modal.className = 'project-modal project-edit-modal';
    modal.innerHTML = `
      <section class="modal-content" role="dialog" aria-modal="true" aria-labelledby="project-edit-title" tabindex="-1">
        <header class="project-modal-header">
          <div class="project-modal-heading">
            <span class="project-modal-eyebrow">EDIÇÃO DO PROJETO</span>
            <h2 id="project-edit-title">${utils.sanitize(project.name)}</h2>
            <span class="project-modal-code">Código ${utils.sanitize(project.code)}</span>
          </div>
          <button type="button" class="close-modal" aria-label="Cancelar e fechar edição">&times;</button>
        </header>
        <form class="project-edit-form" novalidate>
          <div class="edit-context" role="status"><strong>Modo de edição ativo.</strong> Revise os campos e salve somente quando terminar.</div>
          <div class="project-modal-body document-form">
            <div class="form-group"><label for="edit-project-name">Nome do projeto</label><input id="edit-project-name" class="form-control" value="${utils.sanitize(project.name)}" required></div>
            <div class="form-group"><label for="edit-project-code">Código do projeto</label><input id="edit-project-code" class="form-control" value="${utils.sanitize(project.code)}" minlength="3" required></div>
            <div class="form-group"><label for="edit-project-manager">Responsável</label><input id="edit-project-manager" class="form-control" value="${utils.sanitize(project.manager)}" required></div>
            <div class="form-group"><label for="edit-project-start">Data de início</label><input id="edit-project-start" type="date" class="form-control" value="${dateValue(project.start_date)}" required></div>
            <div class="form-group"><label for="edit-project-end">Previsão de término</label><input id="edit-project-end" type="date" class="form-control" value="${dateValue(project.end_date)}"></div>
            <div class="form-group"><label for="edit-project-status">Status</label><select id="edit-project-status" class="form-control" required><option value="planejamento"${selected('planejamento')}>Planejamento</option><option value="andamento"${selected('andamento')}>Em andamento</option><option value="suspenso"${selected('suspenso')}>Suspenso</option><option value="concluido"${selected('concluido')}>Concluído</option></select></div>
            <div class="form-group form-wide"><label for="edit-project-description">Descrição</label><textarea id="edit-project-description" class="form-control" rows="4" required>${utils.sanitize(project.description || '')}</textarea></div>
            <div class="form-group form-wide"><label for="edit-project-files">Adicionar documentos</label><input id="edit-project-files" type="file" class="form-control" multiple accept=".pdf,.doc,.docx,.xls,.xlsx,.jpg,.jpeg,.png"><small class="form-text">Os documentos atuais serão preservados; selecione arquivos apenas para adicionar novos.</small></div>
          </div>
          <footer class="project-edit-actions"><button type="button" class="btn-cancel-edit">Cancelar edição</button><button type="submit" class="btn-submit">${window.documentIcons.markup('save')} Salvar alterações</button></footer>
        </form>
      </section>`;

    document.body.appendChild(modal);
    document.body.classList.add('project-modal-open');
    const form = modal.querySelector('.project-edit-form');
    const content = modal.querySelector('.modal-content');
    let changed = false;
    const closeModal = () => {
      document.removeEventListener('keydown', handleModalKeydown);
      modal.remove();
      document.body.classList.remove('project-modal-open');
      if (previousFocus instanceof HTMLElement && previousFocus.isConnected) previousFocus.focus();
    };
    const requestClose = () => {
      if (!changed || window.confirm('Descartar as alterações não salvas deste projeto?')) closeModal();
    };
    const handleModalKeydown = event => {
      if (event.key === 'Escape') { requestClose(); return; }
      if (event.key !== 'Tab') return;
      const focusable = [...modal.querySelectorAll('input, select, textarea, button:not([disabled])')].filter(element => element.getClientRects().length > 0);
      const lastFocusable = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === focusable[0]) { event.preventDefault(); lastFocusable.focus(); }
      else if (!event.shiftKey && document.activeElement === lastFocusable) { event.preventDefault(); focusable[0].focus(); }
    };
    modal.querySelector('.close-modal').addEventListener('click', requestClose);
    modal.querySelector('.btn-cancel-edit').addEventListener('click', requestClose);
    modal.addEventListener('click', event => { if (event.target === modal) requestClose(); });
    form.addEventListener('input', () => { changed = true; });
    form.addEventListener('change', () => { changed = true; });
    form.querySelector('#edit-project-start').addEventListener('change', event => { form.querySelector('#edit-project-end').min = event.target.value; });
    document.addEventListener('keydown', handleModalKeydown);
    modal.classList.add('active');
    content.focus();

    form.addEventListener('submit', async event => {
      event.preventDefault();
      if (!form.reportValidity()) return;
      const start = form.querySelector('#edit-project-start').value;
      const end = form.querySelector('#edit-project-end').value;
      if (end && end < start) { ErroMessage('A data de término não pode ser anterior à data de início.'); return; }
      const submitBtn = form.querySelector('[type="submit"]');
      const originalLabel = submitBtn.innerHTML;
      try {
        submitBtn.disabled = true;
        submitBtn.innerHTML = `${window.documentIcons.markup('loading', 'ui-icon is-loading')} Salvando alterações...`;
        const projectData = {
          name: form.querySelector('#edit-project-name').value.trim(),
          code: form.querySelector('#edit-project-code').value.trim(),
          manager: form.querySelector('#edit-project-manager').value.trim(),
          start_date: start,
          end_date: end || null,
          status: form.querySelector('#edit-project-status').value,
          description: form.querySelector('#edit-project-description').value.trim()
        };
        const formData = new FormData();
        formData.append('project', JSON.stringify(projectData));
        for (const file of form.querySelector('#edit-project-files').files) formData.append('files', file);
        const response = await fetch(`${API_URL}/projects/${project.id}`, { method: 'PUT', headers: { 'Authorization': `Bearer ${token}` }, body: formData });
        if (!response.ok) throw await window.documentFeedback.requestError(response, 'Não foi possível atualizar o projeto.');
        const data = await response.json();
        if (!data.success) throw new Error(data.message || 'Não foi possível atualizar o projeto.');
        changed = false;
        closeModal();
        const refreshed = await loadProjects();
        SuccessMessage(refreshed ? 'Projeto atualizado com sucesso!' : 'Projeto atualizado, mas a lista não foi atualizada. Recarregue a página.', refreshed ? 'success' : 'info');
      } catch (error) {
        ErroMessage(window.documentFeedback.errorMessage(error, 'Não foi possível atualizar o projeto.'));
      } finally {
        if (submitBtn.isConnected) { submitBtn.disabled = false; submitBtn.innerHTML = originalLabel; }
      }
    });
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
