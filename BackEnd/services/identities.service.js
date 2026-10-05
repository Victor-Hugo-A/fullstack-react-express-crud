const fs = require('node:fs');
const path = require('node:path');

function createIdentitiesService({ repository, uploadsDir }) {
  return {
    async create(data, file) {
      const foto = file ? `/uploads/identities/${file.filename}` : null;
      try {
        const id = await repository.create({
          nome: data.nome,
          cpf: data.cpf,
          endereco: data.endereco,
          perfil: data.perfil,
          foto,
          createdAt: new Date().toISOString()
        });
        return { id, foto };
      } catch (error) {
        if (file?.path) {
          try {
            await fs.promises.unlink(file.path);
          } catch (cleanupError) {
            if (cleanupError.code !== 'ENOENT') console.error('Erro ao remover foto não salva:', cleanupError);
          }
        }
        throw error;
      }
    },

    list() {
      return repository.list();
    },

    count(year) {
      return repository.count(year);
    },

    groupByPerfil() {
      return repository.groupByPerfil();
    },

    async delete(id) {
      const identity = await repository.findById(id);
      if (!identity) return { notFound: true };

      if (identity.foto) {
        if (!/^\/uploads\/identities\/[^/\\]+$/.test(identity.foto)) {
          return { invalidPhotoPath: true };
        }
        try {
          await fs.promises.unlink(path.join(uploadsDir, path.basename(identity.foto)));
        } catch (error) {
          if (error.code !== 'ENOENT') return { photoError: error };
        }
      }

      await repository.delete(id);
      return { deleted: true };
    }
  };
}

module.exports = { createIdentitiesService };
