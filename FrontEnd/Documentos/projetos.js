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
  projectsTable.className = 'projects-table-container';
  document.querySelector('.document-section:last-child').appendChild(projectsTable);

  // Variáveis Globais
  let allProjects = [];
  const token = localStorage.getItem('token');
  
  // Inicialização
  initDatePickers();
  loadProjects();
  setupEventListeners();

  function initDatePickers() {
    // Config data mínima no campo de início
    // const today = new Date().toISOString().split('T')[0];
    // document.getElementById('project-start').min = today;

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
    submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Salvando...';

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

      const response = await fetch(`${API_URL}/projects`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        },
        body: formData
      });

      if (!response.ok) {
        let errorMsg = 'Erro ao criar projeto';
        try {
          const errorData = await response.json();
          errorMsg = errorData.message || errorMsg;
        } catch {
          const errorText = await response.text();
          errorMsg = errorText || errorMsg;
        }
        throw new Error(errorMsg);
      }

      const data = await response.json();
      projectForm.reset();
      await loadProjects();
      SuccessMessage('Projeto criado com sucesso!', 'success');
    } catch (error) {
      console.error('Erro ao criar projeto:', error);
      const errorMsg = error.message.includes('<!DOCTYPE html>') 
        ? 'Erro no servidor - Verifique a conexão com a API' 
        : error.message;
      ErroMessage(errorMsg, 'error');
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
        const errorText = await response.text();
        console.error('Resposta do servidor:', errorText);

        if (response.status === 401 || response.status === 403) {
          window.location.href = '/login.html';
          return;
        }
        
        throw new Error(`Erro ao carregar projetos: ${response.statusText}`);
      }
      
      const data = await response.json();
      allProjects = data.projects || [];
      renderProjects(allProjects);
    } catch (error) {
      console.error('Erro ao carregar projetos:', error);
      ErroMessage(
        error.message.includes('<!DOCTYPE html>') 
          ? 'Erro no servidor - Verifique a conexão com a API' 
          : error.message, 
        'error'
      );
      projectsTable.innerHTML = `<div class="error-content">Erro ao carregar projetos: ${utils.sanitize(error.message)}</div>`;
    } finally {
      loadingProjects.style.display = 'none';
    }
  }

  function renderProjects(projects) {
    projectsTable.innerHTML = '';

    if (projects.length === 0) {
      projectsTable.innerHTML = '<p class="no-projects">Nenhum projeto encontrado</p>';
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

    projects.forEach(project => {
      const row = document.createElement('tr');
      row.innerHTML = `
        <td>${utils.sanitize(project.code)}</td>
        <td>${utils.sanitize(project.name)}</td>
        <td>${utils.sanitize(project.manager)}</td>
        <td>${utils.formatDate(project.start_date)}</td>
        <td>${project.end_date ? utils.formatDate(project.end_date) : '-'}</td>
        <td><span class="status-badge ${utils.sanitize(project.status)}">${utils.getStatusText(project.status)}</span></td>
        <td class="actions">
          <button class="btn-view project" data-id="${project.id}" title="Visualizar Projeto"><i class="fas fa-eye"></i></button>
          <button class="btn-edit project" data-id="${project.id}" title="Editar Projeto"><i class="fas fa-edit"></i></button>
          <button class="btn-delete project" data-id="${project.id}" title="Excluir Projeto"><i class="fas fa-trash-alt"></i></button>
        </td>
      `;
      tbody.appendChild(row);
    });
    
    table.appendChild(tbody);
    projectsTable.appendChild(table);
    
    // Adiciona eventos aos botões
    addProjectActionEvents();
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

    renderProjects(filtered);
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
        const errorText = await response.text();
        throw new Error(errorText || 'Erro ao carregar projeto');
      }

      const data = await response.json();
      const project = data.project || data;
      if (!project || !project.name) {
        throw new Error('Projeto não encontrado ou resposta inválida');
      }
      showProjectDetails(data.project);
    } catch (error) {
      console.error('Erro ao visualizar projeto:', error);
      ErroMessage(error.message, 'error');
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
        <span class="close-modal"> &times; </span>
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
                  const fileUrl = `${API_URL}/project-files/${file.filename}`;
                  return `
                  <div class="file-item" data-file-id="${file._id || file.id}">
                    <div class="file-info">
                      ${ext === 'pdf' ? 
                        `<i class="fas fa-file-pdf pdf-icon"></i>` : 
                        `<i class="fas fa-file-image image-icon"></i>`}
                      <a href="${fileUrl}" target="_blank" rel="noopener noreferrer">${utils.sanitize(file.originalname)}</a>
                      <span class="file-size">(${formatFileSize(file.size)})</span>
                    </div>
                    <div class="file-actions">
                      <button class="btn-download-file" data-file-url="${API_URL}/project-files/${file.filename}?download=1" data-filename="${file.originalname}" title="Download do projeto">
                        <i class="fas fa-download"></i>
                      </button>
                      <button class="btn-delete-file" data-file-id="${file._id || file.id}" data-project-id="${project.id}" title="Excluir o arquivo">
                        <i class="fas fa-trash"></i>
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

  function downloadFile(url, filename) {
    if (!url || !filename) {
        console.error('Dados inválidos para download:', {url, filename});
        ErroMessage('Erro ao preparar download: dados incompletos', 'error')
        return;
    }

    try {
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  } catch (error) {
    console.error('Erro ao baixar arquivo:', error)
    ErroMessage('Erro ao baixar arquivo. Tente novamente')
  }
}

  async function deleteFile(fileId, projectId) {
    if (!fileId || !projectId) {
        console.error('IDs inválidos:', {fileId, projectId});
        showMessage('Erro interno: IDs não encontrados', 'error');
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
    try {
      // Mostrar loader
      const editBtn = document.querySelector(`.btn-edit[data-id="${projectId}"]`);
      const originalContent = editBtn.innerHTML;
      editBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';
      editBtn.disabled = true;

      // Carrega os dados do projeto
      const response = await fetch(`${API_URL}/projects/${projectId}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(errorText || 'Erro ao carregar projeto para edição');
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
      submitBtn.innerHTML = '<i class="fas fa-save me-2"></i>Atualizar Projeto';
      submitBtn.dataset.editing = projectId;
      submitBtn.classList.add('btn-update');
      
      SuccessMessage('Preencha os campos que deseja alterar!', 'info');

      // Remove o evento antigo e adiciona o novo
      projectForm.removeEventListener('submit', handleProjectSubmit);
      projectForm.addEventListener('submit', handleProjectUpdate);

      
    } catch (error) {
      console.error('Erro ao editar projeto', error);
      ErroMessage(error.message, 'error');
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
    
    try {
      submitBtn.disabled = true;
      submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Atualizando...';

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
        const errorText = await response.text();
        throw new Error(errorText || 'Erro ao atualizar projeto');
      }

      const data = await response.json();
      console.log('Projeto atualizado:', data);
      // Limpa o formulário
      projectForm.reset();
      await loadProjects();
      
      // Exibe mensagem de sucesso
      SuccessMessage('Projeto atualizado com sucesso!', 'success');

      // Restaura o formulário para modo de criação
      submitBtn.innerHTML = '<i class="fas fa-save me-2"></i>Salvar Projeto';
      delete submitBtn.dataset.editing;
      submitBtn.classList.remove('btn-update');


      
      projectForm.removeEventListener('submit', handleProjectUpdate);
      projectForm.addEventListener('submit', handleProjectSubmit);
    } catch (error) {
      console.error('Erro ao atualizar projeto:', error);
      ErroMessage(error.message, 'error');
    } finally {
      submitBtn.disabled = false;
      submitBtn.innerHTML = originalBtnText;
    }
  }

  async function deleteProject(projectId) {
    try {
      const deleteBtn = document.querySelector(`.btn-delete[data-id="${projectId}"]`);
      const originalContent = deleteBtn.innerHTML;
      deleteBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';
      deleteBtn.disabled = true;

      const response = await fetch(`${API_URL}/projects/${projectId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(errorText || 'Erro ao excluir projeto');
      }

      const data = await response.json();
      data.project = data.project || data;
      await loadProjects();
      SuccessMessage('Projeto excluído com sucesso!', 'success');
    } catch (error) {
      console.error('Erro ao excluir projeto:', error);
      ErroMessage(error.message, 'error');
    } finally {
      if (deleteBtn) {
        deleteBtn.innerHTML = originalContent;
        deleteBtn.disabled = false;
      }
    }
  }


  function ErroMessage(message, type) {
    projectMessage.textContent = message;
    projectMessage.className = `message ${type}`;
    projectMessage.style.display = 'block';
    projectMessage.style.backgroundColor ='#f8d7da';

    setTimeout(() => {
      projectMessage.style.display = 'none';
    }, 5000);
  }


  function SuccessMessage(message, type) {
    projectMessage.textContent = message;
    projectMessage.className = `message ${type}`;
    projectMessage.style.display = 'block';
    projectMessage.style.backgroundColor = '#7CFC00' 

    setTimeout(() => {
      projectMessage.style.display = 'none';
    }, 5000);
  }
});