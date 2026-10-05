function createIdentitiesRepository(db) {
  function all(sql, params = []) {
    return new Promise((resolve, reject) => {
      db.all(sql, params, (error, rows) => error ? reject(error) : resolve(rows));
    });
  }

  function get(sql, params = []) {
    return new Promise((resolve, reject) => {
      db.get(sql, params, (error, row) => error ? reject(error) : resolve(row));
    });
  }

  function run(sql, params = []) {
    return new Promise((resolve, reject) => {
      db.run(sql, params, function (error) {
        if (error) return reject(error);
        resolve({ lastID: this.lastID, changes: this.changes });
      });
    });
  }

  return {
    list() {
      return all('SELECT * FROM identities');
    },

    async create({ nome, cpf, endereco, perfil, foto, createdAt }) {
      const result = await run(
        `INSERT INTO identities (nome, cpf, endereco, perfil, foto, created_at)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [nome, cpf, endereco, perfil, foto, createdAt]
      );
      return result.lastID;
    },

    findById(id) {
      return get('SELECT * FROM identities WHERE id = ?', [id]);
    },

    delete(id) {
      return run('DELETE FROM identities WHERE id = ?', [id]);
    },

    count(year) {
      let sql = 'SELECT COUNT(*) as count FROM identities';
      const params = [];
      if (year) {
        sql += ' WHERE created_at LIKE ?';
        params.push(`${year}%`);
      }
      return get(sql, params);
    },

    groupByPerfil() {
      return all('SELECT perfil, COUNT(*) as count FROM identities GROUP BY perfil');
    }
  };
}

module.exports = { createIdentitiesRepository };
