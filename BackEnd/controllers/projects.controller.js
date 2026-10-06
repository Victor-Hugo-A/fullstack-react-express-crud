function createProjectsController(service) {
  return {
    groupByStatus: async (req, res) => {
      try {
        res.json(await service.groupByStatus());
      } catch (error) {
        res.status(500).json([]);
      }
    },

    count: async (req, res) => {
      try {
        const row = await service.count(req.query.year);
        res.json({ count: row.count });
      } catch (error) {
        res.status(500).json({ count: 0, error: 'Erro ao contar projetos' });
      }
    },

    create: async (req, res) => {
      try {
        const result = await service.create(req.body.project, req.files);
        if (result.validationMessage) {
          return res.status(400).json({ success: false, message: result.validationMessage });
        }
        return res.json({ success: true, projectId: result.projectId, projectName: result.projectName });
      } catch (error) {
        if (error.message && error.message.includes('UNIQUE constraint failed: projects.code')) {
          return res.status(400).json({ success: false, message: 'Código do projeto já existe' });
        }
        console.error('Erro ao criar projeto:', error);
        return res.status(500).json({ success: false, message: error.message });
      }
    },

    list: async (req, res) => {
      try {
        const result = await service.list(req.query);
        return res.json({ success: true, ...result });
      } catch (error) {
        console.error('Erro ao buscar projetos:', error);
        return res.status(500).json({ success: false, message: error.message });
      }
    },

    get: async (req, res) => {
      try {
        const project = await service.find(req.params.id);
        if (!project) return res.status(404).json({ success: false, message: 'Projeto não encontrado' });
        return res.json({ success: true, project });
      } catch (error) {
        console.error('Erro ao buscar projeto:', error);
        return res.status(500).json({ success: false, message: error.message });
      }
    },

    getFile: async (req, res) => {
      try {
        const result = await service.resolveFile(req.params.filename);
        if (result.validationMessage) {
          return res.status(400).json({ success: false, message: result.validationMessage });
        }
        if (result.notFound) {
          return res.status(404).json({ success: false, message: 'Arquivo não encontrado' });
        }
        if (req.query.download === '1') return res.download(result.filePath, req.params.filename);
        return res.sendFile(result.filePath);
      } catch (error) {
        console.error('Erro ao baixar arquivo:', error);
        return res.status(500).json({ success: false, message: error.messsage });
      }
    },

    deleteFile: async (req, res) => {
      try {
        const file = await service.deleteFile(req.params.id);
        if (!file) return res.status(404).json({ success: false, message: 'Arquivo não encontrado' });
        return res.json({
          success: true,
          message: 'Arquivo deletado com sucesso',
          projectId: file.project_id
        });
      } catch (error) {
        return res.status(500).json({ success: false, message: error.message });
      }
    },

    update: async (req, res) => {
      try {
        const project = await service.update(req.params.id, req.body.project, req.files);
        if (project.validationMessage) {
          return res.status(400).json({ success: false, message: project.validationMessage });
        }
        return res.json({ success: true, project });
      } catch (error) {
        console.error('Erro ao atualizar projeto:', error);
        return res.status(500).json({ success: false, message: error.message });
      }
    },

    delete: async (req, res) => {
      try {
        const deleted = await service.delete(req.params.id);
        if (!deleted) return res.status(404).json({ success: false, message: 'Projeto não encontrado' });
        return res.json({ success: true });
      } catch (error) {
        console.error('Erro ao deletar projeto:', error);
        return res.status(500).json({ success: false, message: error.message });
      }
    }
  };
}

module.exports = { createProjectsController };
