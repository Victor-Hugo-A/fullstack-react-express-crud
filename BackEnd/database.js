const sqlite3 = require('sqlite3').verbose();
const path = require('path');
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
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )`, 
      (err) => {
      if (err) return reject(err);
      resolve();
    });
  });
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
      foto TEXT
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
      password: await bcrypt.hash(userData.password, 10),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()

    };

    return new Promise((resolve, reject) => {
      db.run(
        `INSERT INTO users (id, nome, email, username, password, created_at, updated_at) 
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [user.id, user.nome, user.email, user.username, user.password, user.created_at, user.updated_at],
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
        'SELECT * FROM users WHERE username = ?',
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

  async getAll() {
    return new Promise((resolve, reject) => {
      db.all(
        'SELECT id, nome, email, username, created_at FROM users',
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

// Inicializa o banco de dados quando o módulo é carregado
initializeDatabase().catch(err => {
  console.error('Falha na inicialização do banco de dados:', err);
});

module.exports = {
  db,
  userRepository,
  initializeDatabase,
  closeDatabase
};