const { db } = require('../database');

function get(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (error, row) => error ? reject(error) : resolve(row || null));
  });
}

function all(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (error, rows) => error ? reject(error) : resolve(rows));
  });
}

function run(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function (error) {
      if (error) return reject(error);
      resolve({ changes: this.changes, lastID: this.lastID });
    });
  });
}

const contractColumns = `
  id, type, number, date, description,
  file_name AS fileName, original_name AS originalName,
  file_path AS filePath, mime_type AS mimeType,
  created_at AS createdAt, updated_at AS updatedAt
`;

const contractsRepository = {
  list({ type, year, search } = {}) {
    const conditions = [];
    const params = [];
    if (type) {
      conditions.push('type = ?');
      params.push(type);
    }
    if (year) {
      conditions.push('substr(date, 1, 4) = ?');
      params.push(year);
    }
    if (search) {
      conditions.push('(lower(number) LIKE ? OR lower(description) LIKE ?)');
      params.push(`%${search.toLowerCase()}%`, `%${search.toLowerCase()}%`);
    }
    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    return all(`SELECT ${contractColumns} FROM contracts ${where} ORDER BY date DESC`, params);
  },

  findById(id) {
    return get(`SELECT ${contractColumns} FROM contracts WHERE id = ?`, [id]);
  },

  numberExists(number, exceptId) {
    const sql = `SELECT 1 AS found FROM contracts WHERE number = ?${exceptId ? ' AND id != ?' : ''} LIMIT 1`;
    return get(sql, exceptId ? [number, exceptId] : [number]);
  },

  create(contract) {
    return run(`
      INSERT INTO contracts
        (id, type, number, date, description, file_name, original_name, file_path, mime_type, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      contract.id, contract.type, contract.number, contract.date, contract.description,
      contract.fileName, contract.originalName, contract.filePath, contract.mimeType, contract.createdAt
    ]);
  },

  update(id, contract) {
    return run(`
      UPDATE contracts SET type = ?, number = ?, date = ?, description = ?,
        file_name = ?, original_name = ?, file_path = ?, mime_type = ?, updated_at = ?
      WHERE id = ?
    `, [
      contract.type, contract.number, contract.date, contract.description,
      contract.fileName, contract.originalName, contract.filePath, contract.mimeType,
      contract.updatedAt, id
    ]);
  },

  delete(id) {
    return run('DELETE FROM contracts WHERE id = ?', [id]);
  },

  clear() {
    return run('DELETE FROM contracts');
  },

  deleteWithoutFiles(existingFiles) {
    return new Promise((resolve, reject) => {
      db.serialize(() => {
        db.run('BEGIN IMMEDIATE', error => {
          if (error) return reject(error);
          const placeholders = existingFiles.map(() => '?').join(',');
          const sql = existingFiles.length
            ? `DELETE FROM contracts WHERE file_name NOT IN (${placeholders})`
            : 'DELETE FROM contracts';
          db.run(sql, existingFiles, function (deleteError) {
            if (deleteError) {
              return db.run('ROLLBACK', rollbackError => reject(rollbackError || deleteError));
            }
            const changes = this.changes;
            db.run('COMMIT', commitError => commitError ? reject(commitError) : resolve(changes));
          });
        });
      });
    });
  },

  count(year) {
    const condition = year ? ' WHERE substr(date, 1, 4) = ?' : '';
    return get(`SELECT COUNT(*) AS count FROM contracts${condition}`, year ? [year] : [])
      .then(row => row.count);
  },

  countByType() {
    return all('SELECT lower(type) AS tipo, COUNT(*) AS count FROM contracts GROUP BY lower(type)');
  },

  async findByNumber(number) {
    return get('SELECT id FROM contracts WHERE number = ? LIMIT 1', [number]);
  },

  async listByDateRange(from, to) {
    const conditions = [];
    const params = [];
    if (from) {
      conditions.push('substr(date, 1, 10) >= ?');
      params.push(from);
    }
    if (to) {
      conditions.push('substr(date, 1, 10) <= ?');
      params.push(to);
    }
    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    return all(`SELECT ${contractColumns} FROM contracts ${where} ORDER BY date DESC`, params);
  }
};

module.exports = contractsRepository;
