function createIdentitiesController(service) {
  return {
    create: async (req, res) => {
      try {
        const result = await service.create(req.body, req.file);
        return res.json({ success: true, id: result.id, foto: result.foto });
      } catch (error) {
        return res.status(500).json({ success: false, error: error.message });
      }
    },

    list: async (req, res) => {
      try {
        return res.json(await service.list());
      } catch (error) {
        return res.status(500).json({ success: false, error: error.message });
      }
    },

    delete: async (req, res) => {
      try {
        const result = await service.delete(req.params.id);
        if (result.notFound) {
          return res.status(404).json({ success: false, message: 'Identidade não encontrada' });
        }
        if (result.invalidPhotoPath) {
          return res.status(500).json({ success: false, message: 'Caminho da foto inválido' });
        }
        if (result.photoError) {
          console.error('Erro ao excluir foto da identidade:', result.photoError);
          return res.status(500).json({ success: false, message: 'Erro ao excluir foto da identidade' });
        }
        return res.json({ success: true });
      } catch (error) {
        return res.status(500).json({ success: false, message: error.message });
      }
    },

    count: async (req, res) => {
      try {
        const row = await service.count(req.query.year);
        return res.json({ count: row.count });
      } catch {
        return res.status(500).json({ count: 0, error: 'Erro ao contar identidades' });
      }
    },

    groupByPerfil: async (req, res) => {
      try {
        return res.json(await service.groupByPerfil());
      } catch {
        return res.status(500).json([]);
      }
    }
  };
}

module.exports = { createIdentitiesController };
