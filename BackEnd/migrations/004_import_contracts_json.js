const fs = require('node:fs');
const path = require('node:path');
const { randomUUID } = require('node:crypto');

function execute(db, sql, params = []) {
  return new Promise((resolve, reject) => {
    db.run(sql, params, error => error ? reject(error) : resolve());
  });
}

async function up(db) {
  const legacyPath = path.join(__dirname, '..', 'data', 'contracts.json');
  if (!fs.existsSync(legacyPath)) return;

  let contracts;
  try {
    const contents = fs.readFileSync(legacyPath, 'utf8');
    contracts = JSON.parse(contents || '[]');
  } catch (error) {
    throw new Error(`Não foi possível importar contracts.json sem risco aos dados: ${error.message}`);
  }
  if (!Array.isArray(contracts)) {
    throw new Error('A migração de contracts.json esperava uma lista de contratos.');
  }

  for (const [index, contract] of contracts.entries()) {
    if (!contract || typeof contract !== 'object' || Array.isArray(contract) ||
        !contract.type || !contract.number || !contract.date ||
        !contract.fileName || !contract.originalName) {
      throw new Error(`Registro ${index + 1} de contracts.json não contém os campos obrigatórios.`);
    }

    const fileName = String(contract.fileName).split(/[\\/]/).pop();
    if (!fileName || fileName === '.' || fileName === '..') {
      throw new Error(`Registro ${index + 1} de contracts.json contém um nome de arquivo inválido.`);
    }

    await execute(db, `
      INSERT INTO contracts
        (id, type, number, date, description, file_name, original_name, file_path, mime_type, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      String(contract.id || randomUUID()),
      String(contract.type),
      String(contract.number),
      String(contract.date),
      String(contract.description || ''),
      fileName,
      String(contract.originalName),
      `/uploads/contracts/${fileName}`,
      String(contract.mimeType || 'application/octet-stream'),
      String(contract.createdAt || new Date().toISOString()),
      contract.updatedAt ? String(contract.updatedAt) : null
    ]);
  }
}

module.exports = { up };
