const fs = require('node:fs');
const path = require('node:path');

function createProjectsService({ repository, uploadsDir }) {
  async function attachFiles(projects) {
    for (const project of projects) {
      project.files = await repository.filesForProject(project.id);
    }
    return projects;
  }

  async function saveFiles(projectId, files) {
    if (files && files.length > 0) {
      for (const file of files) {
        await repository.createFile(projectId, {
          ...file,
          originalName: file.originalname || path.basename(file.originalname)
        });
      }
    }
  }

  return {
    async create(data, files) {
      const projectData = JSON.parse(data);
      const allowedStatuses = ['planejamento', 'andamento', 'suspenso', 'concluido'];
      if (!allowedStatuses.includes(projectData.status)) {
        return { validationMessage: 'Status inválido' };
      }
      if (!/^\d{4}-\d{2}-\d{2}$/.test(projectData.start_date)) {
        return { validationMessage: 'Data de início inválida' };
      }
      if (!projectData.name || !projectData.code || !projectData.manager ||
          !projectData.start_date || !projectData.description) {
        return { validationMessage: 'Preencha todos os campos obrigatórios' };
      }

      const projectId = await repository.create(projectData);
      await saveFiles(projectId, files);
      return { projectId };
    },

    async list(query) {
      const page = parseInt(query.page) || 1;
      const limit = parseInt(query.limit) || 10;
      const projects = await repository.list({ page, limit, status: query.status });
      return { projects: await attachFiles(projects), page, limit };
    },

    async count(year) {
      return repository.count(year);
    },

    groupByStatus() {
      return repository.groupByStatus();
    },

    async find(id) {
      const project = await repository.findById(id);
      if (project) project.files = await repository.filesForProject(id);
      return project;
    },

    async update(id, data, files) {
      const projectData = JSON.parse(data);
      const allowedStatuses = ['planejamento', 'andamento', 'suspenso', 'concluido'];
      if (!allowedStatuses.includes(projectData.status)) {
        return { validationMessage: 'Status inválido' };
      }
      if (!/^\d{4}-\d{2}-\d{2}$/.test(projectData.start_date)) {
        return { validationMessage: 'Data de início inválida' };
      }

      await repository.update(id, projectData);
      await saveFiles(id, files);
      const project = await repository.findById(id);
      project.files = await repository.filesForProject(id);
      return project;
    },

    async resolveFile(filename) {
      if (path.basename(filename) !== filename) {
        return { validationMessage: 'Nome de arquivo inválido' };
      }
      const filePath = path.join(uploadsDir, filename);
      if (!fs.existsSync(filePath)) return { notFound: true };
      return { filePath };
    },

    async deleteFile(id) {
      const file = await repository.findFileById(id);
      if (!file) return null;
      const filePath = path.join(uploadsDir, file.filename);
      if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
      await repository.deleteFile(id);
      return file;
    },

    async delete(id) {
      const project = await repository.findById(id);
      if (!project) return false;

      const files = await repository.filesForProjectDeletion(id);
      for (const file of files) {
        try {
          const filePath = path.join(uploadsDir, file.filename);
          if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
        } catch (error) {
          console.error('Erro ao deletar arquivo:', error);
        }
      }
      await repository.delete(id);
      return true;
    }
  };
}

module.exports = { createProjectsService };
