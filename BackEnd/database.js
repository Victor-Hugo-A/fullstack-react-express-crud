const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');
const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');

// Configuração do banco de dados
const DB_PATH = path.join(__dirname, 'database.sqlite');
const db = new sqlite3.Database(DB_PATH);

// Configurações do banco de dados
const DB_CONFIG = {
  foreignKeys: true,
  busyTimeout: 5000
};

// Inicialização do banco de dados
const initializeDatabase = async () => {
  try {
    await dbConfigure();
    await createTables();
    await ensureAdminColumn();
    await runMigrations();
    await createIndexes();
    console.log('Banco de dados inicializado com sucesso');
  } catch (error) {
    console.error('Erro ao inicializar o banco de dados:', error);
    throw error;
  }
};

// Configurações do banco
const dbConfigure = () => {
  return new Promise((resolve, reject) => {
    db.serialize(() => {
      db.run(`PRAGMA foreign_keys = ${DB_CONFIG.foreignKeys ? 'ON' : 'OFF'}`);
      db.run(`PRAGMA busy_timeout = ${DB_CONFIG.busyTimeout}`);
      resolve();
    });
  });
};

// Criação das tabelas
const createTables = () => {
  return new Promise((resolve, reject) => {
    db.run(`
      CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        nome TEXT NOT NULL,
        email TEXT UNIQUE NOT NULL,
        username TEXT UNIQUE NOT NULL,
        password TEXT NOT NULL,
        cpf TEXT NOT NULL,
        departamento TEXT,
        cargo TEXT,
        is_admin INTEGER NOT NULL DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )`, 
      (err) => {
      if (err) return reject(err);
      resolve();
    });
  });
};

// Mantém os cadastros existentes ao atualizar bancos criados antes das permissões.
const ensureAdminColumn = () => new Promise((resolve, reject) => {
  db.all('PRAGMA table_info(users)', (error, columns) => {
    if (error) return reject(error);
    if (columns.some(column => column.name === 'is_admin')) return resolve();
    db.run('ALTER TABLE users ADD COLUMN is_admin INTEGER NOT NULL DEFAULT 0', error => {
      if (error) return reject(error);
      resolve();
    });
  });
});

const runMigrations = async () => {
  await new Promise((resolve, reject) => {
    db.run(`CREATE TABLE IF NOT EXISTS schema_migrations (
      name TEXT PRIMARY KEY,
      applied_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    )`, error => error ? reject(error) : resolve());
  });

  const migrationsDir = path.join(__dirname, 'migrations');
  const migrations = fs.readdirSync(migrationsDir)
    .filter(file => /\.(?:sql|js)$/.test(file))
    .sort();

  for (const name of migrations) {
    const applied = await new Promise((resolve, reject) => {
      db.get('SELECT name FROM schema_migrations WHERE name = ?', [name], (error, row) => {
        if (error) return reject(error);
        resolve(Boolean(row));
      });
    });
    if (applied) continue;

    const migrationPath = path.join(migrationsDir, name);
    await new Promise((resolve, reject) => {
      db.exec('BEGIN IMMEDIATE', error => {
        if (error) return reject(error);
        const applyMigration = name.endsWith('.sql')
          ? new Promise((migrationResolve, migrationReject) => {
            db.exec(fs.readFileSync(migrationPath, 'utf8'), migrationError =>
              migrationError ? migrationReject(migrationError) : migrationResolve());
          })
          : Promise.resolve().then(() => require(migrationPath).up(db));

        applyMigration
          .then(() => new Promise((insertResolve, insertReject) => {
            db.run('INSERT INTO schema_migrations (name) VALUES (?)', [name], insertError =>
              insertError ? insertReject(insertError) : insertResolve());
          }))
          .then(() => new Promise((commitResolve, commitReject) => {
            db.exec('COMMIT', commitError => commitError ? commitReject(commitError) : commitResolve());
          }))
          .then(resolve)
          .catch(migrationError => {
            db.exec('ROLLBACK', rollbackError => reject(rollbackError || migrationError));
          });
      });
    });
  }
};

//Cria a tabela de identidades se não existir
db.serialize(() => {
  db.run(`
    CREATE TABLE IF NOT EXISTS identities (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      nome TEXT NOT NULL,
      cpf TEXT NOT NULL,
      endereco TEXT NOT NULL,
      perfil TEXT NOT NULL,
      foto TEXT,
      created_at TEXT
      )
    `);
  });


db.all("PRAGMA table_info(identities)", [], (err, rows) => {
  if (err) throw err;
  console.log(rows);
});

  module.exports = db;


// Criação de índices
const createIndexes = () => {
  return new Promise((resolve, reject) => {
    db.serialize(() => {
      db.run('CREATE INDEX IF NOT EXISTS idx_users_username ON users(username)', (err) => {
        if (err) return reject(err);
      });
      
      db.run('CREATE INDEX IF NOT EXISTS idx_users_email ON users(email)', (err) => {
        if (err) return reject(err);
      });
      
      db.run('CREATE INDEX IF NOT EXISTS idx_users_created_at ON users(created_at)', (err) => {
        if (err) return reject(err);
        resolve();
      });
    });
  });
};

// Funções do repositório de usuários
const userRepository = {
  async create(userData) {
    const user = {
      id: uuidv4(),
      ...userData,
      account_status: userData.account_status || 'approved',
      password: await bcrypt.hash(userData.password, 10),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()

    };

    return new Promise((resolve, reject) => {
      db.run(
        `INSERT INTO users
          (id, nome, email, username, password, created_at, updated_at, cpf, departamento, cargo, role, is_admin, account_status)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          user.id, user.nome, user.email, user.username, user.password,
          user.created_at, user.updated_at, user.cpf,
          user.departamento || null, user.cargo || null, user.role || 'viewer',
          user.role === 'admin' ? 1 : 0, user.account_status
        ],
        function(err) {
          if (err) return reject(err);
          resolve(user);
        }
      );
    });
  },

  async findByUsername(username) {
    return new Promise((resolve, reject) => {
      db.get(
        `SELECT id, nome, email, username, cpf, password, cargo, departamento,
                account_status, role, is_admin
         FROM users WHERE username = ?`,
        [username],
        (err, row) => {
          if (err) return reject(err);
          resolve(row);
        }
      );
    });
  },

  async findByEmail(email) {
    return new Promise((resolve, reject) => {
      db.get(
        'SELECT * FROM users WHERE email = ?',
        [email],
        (err, row) => {
          if (err) return reject(err);
          resolve(row);
        }
      );
    });
  },

  async updatePassword(userId, newPassword) {
    const hashedPassword = await bcrypt.hash(newPassword, 10);
    
    return new Promise((resolve, reject) => {
      db.run(
        'UPDATE users SET password = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
        [hashedPassword, userId],
        function(err) {
          if (err) return reject(err);
          resolve(this.changes);
        }
      );
    });
  },

    async updateProfile(username, departamento, cargo, cpf) {
      return new Promise((resolve, reject) => {
          db.run(
              `UPDATE users SET departamento = ?, cargo = ?, cpf = ?, updated_at = ? WHERE username = ?`,
              [departamento, cargo, cpf, new Date().toISOString(), username],
              function(err) {
                  if (err) return reject(err);
                  resolve();
              }
          );
      });
  },

  async getAll() {
    return new Promise((resolve, reject) => {
      db.all(
        `SELECT id, nome, email, username, departamento, cargo, role, account_status,
                is_admin, created_at, updated_at
         FROM users ORDER BY nome COLLATE NOCASE, username COLLATE NOCASE`,
        [],
        (err, rows) => {
          if (err) return reject(err);
          resolve(rows);
        }
      );
    });
  },

  async findById(id) {
    return new Promise((resolve, reject) => {
      db.get(
        'SELECT * FROM users WHERE id = ?',
        [id],
        (err, row) => {
          if (err) return reject(err);
          resolve(row);

        }
      );
    });
  },
  async getPending() {
    return new Promise((resolve, reject) => {
      db.all(
        `SELECT id, nome, email, username, departamento, cargo, created_at
         FROM users WHERE account_status = 'pending' ORDER BY created_at ASC`,
        [],
        (error, rows) => error ? reject(error) : resolve(rows)
      );
    });
  },

  async setPendingStatus(id, status) {
    return new Promise((resolve, reject) => {
      db.run(
        `UPDATE users SET account_status = ?, updated_at = CURRENT_TIMESTAMP
         WHERE id = ? AND account_status = 'pending'`,
        [status, id],
        function (error) {
          if (error) return reject(error);
          resolve(this.changes);
        }
      );
    });
  },

  async updateAdminDetails(id, { nome, departamento, cargo, role }) {
    return new Promise((resolve, reject) => {
      db.run(
        `UPDATE users
         SET nome = ?, departamento = ?, cargo = ?, role = ?,
             is_admin = ?, updated_at = CURRENT_TIMESTAMP
         WHERE id = ?`,
        [nome, departamento || null, cargo || null, role, role === 'admin' ? 1 : 0, id],
        function (error) {
          if (error) return reject(error);
          resolve(this.changes);
        }
      );
    });
  },

  async countAdministrators() {
    return new Promise((resolve, reject) => {
      db.get("SELECT COUNT(*) AS count FROM users WHERE role = 'admin'", [], (error, row) =>
        error ? reject(error) : resolve(Number(row?.count || 0))
      );
    });
  }
};

const auditRepository = {
  create(entry) {
    return new Promise((resolve, reject) => {
      db.run(
        `INSERT INTO audit_logs
          (user_id, action, entity, entity_id, outcome, ip_address, request_origin, user_agent)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          entry.userId || null,
          entry.action,
          entry.entity,
          entry.entityId || null,
          entry.outcome || 'success',
          entry.ipAddress || null,
          entry.requestOrigin || null,
          entry.userAgent || null
        ],
        function (error) {
          if (error) return reject(error);
          resolve(this.lastID);
        }
      );
    });
  },

  list(limit = 200) {
    return new Promise((resolve, reject) => {
      db.all(
        `SELECT id, user_id AS userId, action, entity, entity_id AS entityId,
          outcome, occurred_at AS occurredAt, ip_address AS ipAddress,
          request_origin AS requestOrigin, user_agent AS userAgent
         FROM audit_logs ORDER BY id DESC LIMIT ?`,
        [limit],
        (error, rows) => error ? reject(error) : resolve(rows)
      );
    });
  }
};


// Fechar conexão com o banco de dados
const closeDatabase = () => {
  return new Promise((resolve, reject) => {
    db.close((err) => {
      if (err) return reject(err);
      console.log('Conexão com o banco de dados encerrada');
      resolve();
    });
  });
};


// Tratamento de erros do banco de dados
db.on('error', (err) => {
  console.error('Erro no banco de dados:', err.message);
});

module.exports = {
  db,
  userRepository,
  auditRepository,
  initializeDatabase,
  closeDatabase
};
