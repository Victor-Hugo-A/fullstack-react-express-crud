function createProjectsRepository(db) {
  function get(sql, params = []) {
    return new Promise((resolve, reject) => {
      db.get(sql, params, (error, row) => error ? reject(error) : resolve(row));
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
        resolve({ lastID: this.lastID, changes: this.changes });
      });
    });
  }

  return {
    get,
    all,
    run,

    async create(project) {
      const result = await run(
        `INSERT INTO projects (name, code, manager, start_date, end_date, status, description)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [project.name, project.code, project.manager, project.start_date, project.end_date,
          project.status, project.description]
      );
      return result.lastID;
    },

    createFile(projectId, file) {
      return run(
        `INSERT INTO project_files (project_id, filename, originalname, mimetype, size)
         VALUES (?, ?, ?, ?, ?)`,
        [projectId, file.filename, file.originalName, file.mimetype, file.size]
      );
    },

    list({ page, limit, status }) {
      const offset = (page - 1) * limit;
      let sql = 'SELECT * FROM projects';
      const params = [];
      if (status) {
        sql += ' WHERE status = ?';
        params.push(status);
      }
      sql += ' ORDER BY start_date DESC LIMIT ? OFFSET ?';
      params.push(limit, offset);
      return all(sql, params);
    },

    filesForProject(projectId) {
      return all('SELECT * FROM project_files WHERE project_id = ?', [projectId]);
    },

    findById(id) {
      return get('SELECT * FROM projects WHERE id = ?', [id]);
    },

    count(year) {
      let sql = 'SELECT COUNT(*) as count FROM projects';
      const params = [];
      if (year) {
        sql += ' WHERE start_date LIKE ?';
        params.push(`${year}%`);
      }
      return get(sql, params);
    },

    groupByStatus() {
      return all('SELECT status, COUNT(*) as count FROM projects GROUP BY status');
    },

    update(id, project) {
      return run(
        `UPDATE projects
         SET name = ?, code = ?, manager = ?, start_date = ?, end_date = ?, status = ?,
             description = ?, updated_at = CURRENT_TIMESTAMP
         WHERE id = ?`,
        [project.name, project.code, project.manager, project.start_date, project.end_date,
          project.status, project.description, id]
      );
    },

    findFileById(id) {
      return get('SELECT filename, project_id FROM project_files WHERE id = ?', [id]);
    },

    deleteFile(id) {
      return run('DELETE FROM project_files WHERE id = ?', [id]);
    },

    filesForProjectDeletion(id) {
      return all('SELECT filename FROM project_files WHERE project_id = ?', [id]);
    },

    delete(id) {
      return run('DELETE FROM projects WHERE id = ?', [id]);
    }
  };
}

module.exports = { createProjectsRepository };
