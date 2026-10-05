const fs = require('node:fs');
const path = require('node:path');
const { randomUUID } = require('node:crypto');
const contractsRepository = require('../repositories/contracts.repository');

const allowedTypes = new Set(['aditivo', 'servicos', 'fornecimento', 'convenio', 'outro']);

class ServiceError extends Error {
  constructor(status, code, message) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

function validateContract(data) {
  const { type, number, date, description = '' } = data;
  if (typeof type !== 'string' || !allowedTypes.has(type)) {
    throw new ServiceError(400, 'invalid_contract_type', 'Selecione um tipo de contrato válido.');
  }
  if (typeof number !== 'string' || !/^[a-zA-Z0-9_-]{1,100}$/.test(number.trim())) {
    throw new ServiceError(400, 'invalid_contract_number', 'O número do contrato deve conter até 100 letras, números, hífens ou underscores.');
  }
  if (typeof date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(date) ||
      Number.isNaN(Date.parse(`${date}T00:00:00Z`)) ||
      new Date(`${date}T00:00:00Z`).toISOString().slice(0, 10) !== date) {
    throw new ServiceError(400, 'invalid_contract_date', 'Informe uma data de contrato válida.');
  }
  if (typeof description !== 'string' || description.length > 5000) {
    throw new ServiceError(400, 'invalid_contract_description', 'A descrição deve conter até 5000 caracteres.');
  }
  return { type, number: number.trim(), date, description: description.trim() };
}

function contractFilePath(uploadsDir, fileName) {
  if (!fileName || path.basename(fileName) !== fileName) {
    throw new ServiceError(500, 'invalid_stored_filename', 'O caminho do arquivo associado ao contrato é inválido.');
  }
  return path.join(uploadsDir, fileName);
}

async function removeFile(filePath) {
  try {
    await fs.promises.unlink(filePath);
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
  }
}

function publicContract(contract) {
  const { fileName, filePath, ...data } = contract;
  return data;
}

function createContractsService({ uploadsDir, repository = contractsRepository }) {
  return {
    async list(filters) {
      if (filters.type !== undefined && (typeof filters.type !== 'string' || filters.type.length > 30)) {
        throw new ServiceError(400, 'invalid_contract_type', 'Filtro de tipo inválido.');
      }
      if (filters.search !== undefined && (typeof filters.search !== 'string' || filters.search.length > 200)) {
        throw new ServiceError(400, 'invalid_search', 'A busca deve conter até 200 caracteres.');
      }
      return repository.list(filters);
    },

    async count(year) {
      return repository.count(year);
    },

    async countByType() {
      const rows = await repository.countByType();
      return Object.fromEntries(rows.map(row => [row.tipo, row.count]));
    },

    async checkNumber(number) {
      if (number !== undefined && (typeof number !== 'string' || number.length > 100)) {
        throw new ServiceError(400, 'invalid_contract_number', 'Número de contrato inválido.');
      }
      return Boolean(number && await repository.findByNumber(number));
    },

    async create(data, file) {
      if (!file) throw new ServiceError(400, 'missing_contract_file', 'Nenhum arquivo enviado.');
      try {
        const fields = validateContract(data);
        if (await repository.numberExists(fields.number)) {
          throw new ServiceError(409, 'duplicate_contract_number', 'Este número de contrato já está em uso.');
        }
        const contract = {
          ...fields,
          id: randomUUID(),
          fileName: file.filename,
          originalName: file.originalname,
          filePath: `/uploads/contracts/${file.filename}`,
          mimeType: file.mimetype,
          createdAt: new Date().toISOString()
        };
        await repository.create(contract);
        return contract;
      } catch (error) {
        if (file.path) await removeFile(file.path).catch(cleanupError => console.error('Falha ao remover upload de contrato inválido:', cleanupError));
        throw error;
      }
    },

    async update(id, data, file) {
      let updatedFileHandled = false;
      try {
        const previous = await repository.findById(id);
        if (!previous) throw new ServiceError(404, 'contract_not_found', 'Contrato não encontrado.');
        const fields = validateContract(data);
        if (await repository.numberExists(fields.number, id)) {
          throw new ServiceError(409, 'duplicate_contract_number', 'Este número de contrato já está em uso.');
        }
        const contract = {
          ...previous,
          ...fields,
          fileName: file?.filename || previous.fileName,
          originalName: file?.originalname || previous.originalName,
          filePath: file ? `/uploads/contracts/${file.filename}` : previous.filePath,
          mimeType: file?.mimetype || previous.mimeType,
          updatedAt: new Date().toISOString()
        };
        await repository.update(id, contract);
        updatedFileHandled = true;
        if (file && file.filename !== previous.fileName) {
          await removeFile(contractFilePath(uploadsDir, previous.fileName));
        }
        return contract;
      } catch (error) {
        if (file?.path && !updatedFileHandled) {
          await removeFile(file.path).catch(cleanupError => console.error('Falha ao remover upload de contrato não aplicado:', cleanupError));
        }
        throw error;
      }
    },

    async find(id) {
      const contract = await repository.findById(id);
      if (!contract) throw new ServiceError(404, 'contract_not_found', 'Contrato não encontrado.');
      return contract;
    },

    async resolveFile(id) {
      const contract = await repository.findById(id);
      if (!contract) throw new ServiceError(404, 'contract_not_found', 'Contrato não encontrado.');
      const filePath = contractFilePath(uploadsDir, contract.fileName);
      try {
        await fs.promises.access(filePath, fs.constants.R_OK);
      } catch (error) {
        if (error.code === 'ENOENT') {
          throw new ServiceError(404, 'contract_file_not_found', 'Arquivo do contrato não encontrado.');
        }
        throw error;
      }
      return { contract, filePath };
    },

    async delete(id) {
      const contract = await this.find(id);
      await removeFile(contractFilePath(uploadsDir, contract.fileName));
      await repository.delete(id);
      return contract;
    },

    async clear() {
      const contracts = await repository.list({});
      for (const contract of contracts) {
        await removeFile(contractFilePath(uploadsDir, contract.fileName));
      }
      await repository.clear();
      return contracts.length;
    },

    async sync() {
      const filenames = await fs.promises.readdir(uploadsDir);
      await repository.deleteWithoutFiles(filenames);
      return repository.count();
    },

    async getRecent(from, to) {
      return repository.listByDateRange(from, to);
    },

    toPublic: publicContract
  };
}

module.exports = { createContractsService, ServiceError };
