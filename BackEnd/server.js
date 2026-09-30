require('dotenv').config({ path: require('path').join(__dirname, '.env') });
const PORT = Number(process.env.PORT) || 3000;
const SECRET_KEY = process.env.SECRET_KEY;
if (!SECRET_KEY) {
    throw new Error('Configure SECRET_KEY em BackEnd/.env antes de iniciar a API');
}
if (!process.env.SESSION_SECRET) {
    throw new Error('Configure SESSION_SECRET em BackEnd/.env antes de iniciar a API');
}
const express = require('express');
const keycloak = require('./keycloak-config')
const session = require('express-session')
const jwt = require('jsonwebtoken');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const multer = require('multer');
const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const { db, userRepository, initializeDatabase, closeDatabase } = require('./database');
const app = express();
const router = express.Router();
const contractsFilePath = path.join(__dirname, 'data', 'contracts.json');
const mime = require('mime-types');
const compression = require('compression'); // npm install compression
const { count } = require('console');
app.use(compression()); // Ativa compressão globalmente

const corsOptions = {
    origin: ['http://localhost:5500', 'http://127.0.0.1:5500', 'http://localhost:3000', 'http://127.0.0.1:3000', 'http://localhost:3001', 'http://127.0.1:3001'],
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: true,
    optionsSuccessStatus: 200
};
app.use(cors(corsOptions));
app.use('/uploads', authenticateJWT, express.static(path.join(__dirname, 'uploads')));

// CONFIG KEYCLOAK
const config = {
  keycloak: {
    logoutRedirect: 'http://127.0.0.1:5500/FrontEnd/login.html',
    frontendUrl: 'http://127.0.0.1:5500',
    keycloakUrl: 'http://localhost:8080',
    realm: 'meu-realm',
    clientId: 'nodejs-app'
  },
  session: {
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: true,
    store: keycloak.memoryStore,
    cookie: { secure: false } // true em produção com HTTPS
  }
};

app.use(session(config.session));
app.use(keycloak.middleware());

// Rotas públicas
app.get('/', (req, res) => {
  res.send('Página pública - <a href="/seguro">Área segura</a>');
});

// Rota protegida - Melhorada
app.get('/seguro', keycloak.protect(), (req, res) => {
  try {
    const token = req.kauth.grant.access_token.token;
    if (!token) throw new Error('Token não encontrado');
    
    // Melhor prática: Enviar token via HTTP Only cookie em vez de URL
    res.cookie('auth_token', token, { 
      httpOnly: true,
      secure: false, // true em produção
      sameSite: 'lax',
      maxAge: 3600000 // 1 hora
    });
    
    res.redirect(`${config.keycloak.frontendUrl}/FrontEnd/Sistema/sistema.html`);
  } catch (error) {
    console.error('Erro no redirecionamento:', error);
    res.status(400).json({ error: error.message });
  }
});

// Rota de Logout - Versão Aprimorada
app.get('/logout', keycloak.protect(), (req, res) => {
  try {
    // Parâmetros para a URL de login do Keycloak
    const loginParams = new URLSearchParams({
      client_id: 'nodejs-app',
      redirect_uri: 'http://127.0.0.1:5500/FrontEnd/Sistema/sistema.html',
      response_type: 'code',
      scope: 'openid',
      state: crypto.randomUUID(), // Gera um state único
      nonce: crypto.randomUUID(), // Gera um nonce único
      response_mode: 'fragment',
      // PKCE (Opcional mas recomendado)
      code_challenge_method: 'S256',
      code_challenge: 'gerar-um-code-challenge-valido' // Substitua por um valor real
    });

    const keycloakLoginUrl = `http://localhost:8080/realms/meu-realm/protocol/openid-connect/auth?${loginParams.toString()}`;

    // Limpeza de sessão e cookies
    res.clearCookie('auth_token');
    res.clearCookie('connect.sid');
    
    req.session.destroy(() => {
      // Redireciona para a página de login do Keycloak
      res.redirect(keycloakLoginUrl);
    });
  } catch (error) {
    console.error('Erro no logout:', error);
    res.status(500).send('Erro durante o logout');
  }
});

// Configuração de diretórios
const uploadsDir = path.join(__dirname, 'uploads', 'contracts');
const DATA_FILE = path.join(__dirname, 'data', 'contracts.json');

if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
}

if (!fs.existsSync(path.dirname(DATA_FILE))) {
    fs.mkdirSync(path.dirname(DATA_FILE), { recursive: true });
}

// Inicializar arquivo de dados se não existir
if (!fs.existsSync(DATA_FILE)) {
    fs.writeFileSync(DATA_FILE, JSON.stringify([]));
}

app.use('/projects/files', authenticateJWT, express.static(path.join(__dirname, 'uploads', 'projects')));
app.use('/project-files', authenticateJWT, express.static(path.join(__dirname, 'uploads', 'projects')));

// Middlewares
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// Adicionar o router ao app
app.use('/api', router);

// Para proteger rotas Privadas como /POST
function authenticateJWT(req, res, next) {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
        return res.status(401).json({
            success: false,
            message: 'Token de acesso não fornecido'
        })
    }

    jwt.verify(token, SECRET_KEY, (err, user) => {
        if (err) {
            return res.status(403).json({
                success: false,
                message: 'Token inválido ou expirado'
            })
        }
        req.user = user;
        next();
    })
}


async function requireAdmin(req, res, next) {
    try {
        const user = await userRepository.findById(req.user.userId);
        if (!user || user.is_admin !== 1) {
            return res.status(403).json({
                success: false,
                message: 'Acesso permitido apenas a administradores'
            });
        }
        next();
    } catch (error) {
        next(error);
    }
}

// RETORNA DASHBOARD PARA OS TIPOS, STATUS E PERFIL
router.get('/contracts/groupby/type', authenticateJWT, (req, res) => {
    const contracts = readContracts();
    const counts = {};
    contracts.forEach(c => {
        const tipo = (c.type || 'Outro').toLowerCase();
        counts[tipo] = (counts[tipo] || 0) +1;
    });
    res.json(Object.entries(counts).map(([tipo,count]) => ({ tipo, count })));
});

// Identidades por status
router.get('/projects/groupby/status', authenticateJWT, (req, res) => {
    db.all('SELECT status, COUNT(*) as count FROM projects GROUP BY status', [], (err, rows) => {
        if (err) return res.status(500).json([]);
        res.json(rows);
    });
});

// Identidades por perfil
router.get('/identities/groupby/perfil', authenticateJWT, (req, res) => {
    db.all('SELECT perfil, COUNT(*) as count FROM identities GROUP BY perfil', [], (err, rows) => {
        if (err) return res.status(500).json([]);
        res.json(rows);
    });
});

// Resumo único para a página inicial do dashboard. Evita que a interface faça
// várias requisições independentes para montar a mesma visão.
router.get('/dashboard/summary', authenticateJWT, async (req, res) => {
    const queryAll = (sql, params = []) => new Promise((resolve, reject) => {
        db.all(sql, params, (error, rows) => error ? reject(error) : resolve(rows));
    });

    try {
        const contracts = readContracts();
        const contractsByType = Object.entries(contracts.reduce((counts, contract) => {
            const tipo = String(contract.type || 'Outro').toLowerCase();
            counts[tipo] = (counts[tipo] || 0) + 1;
            return counts;
        }, {})).map(([tipo, count]) => ({ tipo, count }));

        const [projectGroups, identityGroups, projectCount, identityCount, recentProjects, recentIdentities] = await Promise.all([
            queryAll('SELECT status, COUNT(*) AS count FROM projects GROUP BY status'),
            queryAll('SELECT perfil, COUNT(*) AS count FROM identities GROUP BY perfil'),
            queryAll('SELECT COUNT(*) AS count FROM projects'),
            queryAll('SELECT COUNT(*) AS count FROM identities'),
            queryAll('SELECT name, status, COALESCE(updated_at, created_at, start_date) AS date FROM projects ORDER BY date DESC LIMIT 3'),
            queryAll('SELECT nome, perfil, created_at AS date FROM identities ORDER BY date DESC LIMIT 3')
        ]);

        const recentContracts = contracts
            .map(contract => ({ title: contract.number || 'Contrato sem número', detail: contract.type || 'Contrato', date: contract.createdAt || contract.date, kind: 'contract' }))
            .sort((first, second) => String(second.date || '').localeCompare(String(first.date || '')))
            .slice(0, 3);
        const recent = [
            ...recentContracts,
            ...recentProjects.map(project => ({ title: project.name, detail: project.status || 'Projeto', date: project.date, kind: 'project' })),
            ...recentIdentities.map(identity => ({ title: identity.nome, detail: identity.perfil || 'Identidade', date: identity.date, kind: 'identity' }))
        ].sort((first, second) => String(second.date || '').localeCompare(String(first.date || ''))).slice(0, 5);

        const totals = {
            contracts: contracts.length,
            projects: Number(projectCount[0]?.count || 0),
            identities: Number(identityCount[0]?.count || 0)
        };
        totals.all = totals.contracts + totals.projects + totals.identities;

        res.json({
            totals,
            groups: { contracts: contractsByType, projects: projectGroups, identities: identityGroups },
            recent,
            updatedAt: new Date().toISOString()
        });
    } catch (error) {
        console.error('Erro ao carregar resumo do dashboard:', error);
        res.status(500).json({ error: 'Não foi possível carregar o resumo do dashboard.' });
    }
});

// Dados agregados para a página de análises. O período usa a data do contrato,
// a data de início do projeto e a data de cadastro da identidade.
router.get('/analysis/summary', authenticateJWT, async (req, res) => {
    const queryAll = (sql, params = []) => new Promise((resolve, reject) => {
        db.all(sql, params, (error, rows) => error ? reject(error) : resolve(rows));
    });
    const from = /^\d{4}-\d{2}-\d{2}$/.test(req.query.from || '') ? req.query.from : null;
    const to = /^\d{4}-\d{2}-\d{2}$/.test(req.query.to || '') ? req.query.to : null;
    if (from && to && from > to) return res.status(400).json({ error: 'O início do período deve ser anterior ao fim.' });
    const dateCondition = (field) => {
        const clauses = [];
        const params = [];
        if (from) { clauses.push(`${field} >= ?`); params.push(from); }
        if (to) { clauses.push(`${field} <= ?`); params.push(to); }
        return { where: clauses.length ? ` WHERE ${clauses.join(' AND ')}` : '', params };
    };

    try {
        const contracts = readContracts().filter(contract => {
            const date = String(contract.date || '').slice(0, 10);
            return (!from || date >= from) && (!to || date <= to);
        });
        const contractsByType = Object.entries(contracts.reduce((counts, contract) => {
            const tipo = String(contract.type || 'Outro').toLowerCase();
            counts[tipo] = (counts[tipo] || 0) + 1;
            return counts;
        }, {})).map(([tipo, count]) => ({ tipo, count }));
        const projectsFilter = dateCondition('start_date');
        const identitiesFilter = dateCondition('created_at');
        const [projectGroups, identityGroups, projectCount, identityCount, completedProjects, overdueProjects, recentProjects, recentIdentities] = await Promise.all([
            queryAll(`SELECT status, COUNT(*) AS count FROM projects${projectsFilter.where} GROUP BY status`, projectsFilter.params),
            queryAll(`SELECT perfil, COUNT(*) AS count FROM identities${identitiesFilter.where} GROUP BY perfil`, identitiesFilter.params),
            queryAll(`SELECT COUNT(*) AS count FROM projects${projectsFilter.where}`, projectsFilter.params),
            queryAll(`SELECT COUNT(*) AS count FROM identities${identitiesFilter.where}`, identitiesFilter.params),
            queryAll(`SELECT COUNT(*) AS count FROM projects${projectsFilter.where}${projectsFilter.where ? ' AND' : ' WHERE'} status = 'concluido'`, projectsFilter.params),
            queryAll(`SELECT COUNT(*) AS count FROM projects${projectsFilter.where}${projectsFilter.where ? ' AND' : ' WHERE'} status != 'concluido' AND end_date IS NOT NULL AND end_date < DATE('now')`, projectsFilter.params),
            queryAll(`SELECT name, code, manager, status, start_date FROM projects${projectsFilter.where} ORDER BY start_date DESC LIMIT 10`, projectsFilter.params),
            queryAll(`SELECT nome, cpf, perfil, created_at FROM identities${identitiesFilter.where} ORDER BY created_at DESC LIMIT 10`, identitiesFilter.params)
        ]);
        const recentContracts = [...contracts].sort((first, second) => String(second.date || '').localeCompare(String(first.date || ''))).slice(0, 10);
        const totals = {
            contracts: contracts.length,
            projects: Number(projectCount[0]?.count || 0),
            identities: Number(identityCount[0]?.count || 0),
            completedProjects: Number(completedProjects[0]?.count || 0),
            overdueProjects: Number(overdueProjects[0]?.count || 0)
        };
        totals.all = totals.contracts + totals.projects + totals.identities;
        res.json({
            totals,
            groups: { contracts: contractsByType, projects: projectGroups, identities: identityGroups },
            recent: { contracts: recentContracts, projects: recentProjects, identities: recentIdentities },
            updatedAt: new Date().toISOString()
        });
    } catch (error) {
        console.error('Erro ao carregar resumo de análises:', error);
        res.status(500).json({ error: 'Não foi possível carregar o resumo das análises.' });
    }
});


// ATUALIZAÇÃO DO BADGE - REGISTROS
router.get('/contracts/count', authenticateJWT, (req, res) => {
    try {
        const year = req.query.year;
        const contracts = readContracts();
        const filtered = year
        ? contracts.filter(c => c.date && c.date.startsWith(year))
        : contracts;
        res.json({ count: filtered.length });
    } catch (error) {
        res.status(500).json({ count: 0, error: 'Erro ao contar contratos' })
    }
});

router.get('/projects/count', authenticateJWT, (req, res) => {
    const year = req.query.year;
    let sql = 'SELECT COUNT(*) as count FROM projects';
    let params = [];
    if (year) {
        sql += ' WHERE start_date LIKE ?';
        params.push(`${year}%`);
    }
    db.get(sql, params, (err, row) => {
        if (err) return res.status(500).json({ count: 0, error: 'Erro ao contar projetos' });
        res.json({ count: row.count });
    });
});

router.get('/identities/count', authenticateJWT, (req, res) => {
    const year = req.query.year;
    let sql = 'SELECT COUNT(*) as count FROM identities';
    let params = [];
    if (year) {
        sql += ' WHERE created_at LIKE ?';
        params.push(`${year}%`);
    }
    db.get(sql, params, (err, row) => {
        if (err) return res.status(500).json({ count: 0, error: 'Erro ao contar identidades' });
        res.json({ count: row.count });
    });
});


app.post('/api/contracts/sync', authenticateJWT, requireAdmin, (req, res) => {
    try {
        // Atualiza a lista de contratos com o sistema de arquivos
        const files = fs.readdirSync(path.join(__dirname, 'uploads/contracts'));
        const currentContracts = loadContracts();
        
        // Filtra contratos que não existem mais
        const validContracts = currentContracts.filter(contract => 
            files.includes(contract.fileName)
        );
        
        saveContracts(validContracts);
        res.json({ success: true, count: validContracts.length });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});


app.get('/api/user', authenticateJWT, async (req, res) => {

    try {
        const authHeader = req.headers['authorization'];

        if (!authHeader) {
            return res.status(401).json({
                success: false,
                message: 'Token de acesso não fornecido'
            });
        }

        const token = authHeader.split(' ')[1];

        if (!token) {
            return res.status(401).json({
                success: false,
                message: 'Formato de token inválido'
            });
        }

        jwt.verify(token, SECRET_KEY, async (err, decoded) => {
            if (err) {
                console.error('Erro na verificação do token', err);
                return res.status(403).json({
                    success: false,
                    message: 'Token inválido ou expirado',
                    error: err.message
                });
            }

            try {
                console.log('Buscando usuário com ID:', decoded.userId);
                const user = await userRepository.findById(decoded.userId);

                if (!user) {
                    console.log('Usuário não encontrado no banco de dados');
                    return res.status(404).json({
                        success: false,
                        message: 'Usuário não encontrado'
                    });
                }

                res.json({
                    success: true,
                    user: {
                        id: user.id,
                        username: user.username,
                        nome: user.nome || user.username,
                        email: user.email,
                        cpf: user.cpf,
                        departamento: user.departamento,
                        cargo: user.cargo,
                        isAdmin: user.is_admin === 1
                    }
                });
            } catch (error) { // Corrigido: variável Error para error
                console.error('Erro no banco de dados', error);
                res.status(500).json({
                    success: false,
                    message: 'Erro interno no servidor',
                });
            }
        });
    } catch (error) {
        console.error('Erro geral no endpoint:', error);
        res.status(500).json({
            success: false,
            message: 'Erro interno no servidor',
        });
    }
});

// Config para uploads de arquivos
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const uploadDir = path.join(__dirname, 'uploads/contracts');
        if (!fs.existsSync(uploadDir)) {
            fs.mkdirSync(uploadDir, { recursive: true });
        }
        cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, uniqueSuffix + path.extname(file.originalname));
    }
});

// Configuração do multer
const upload = multer({ 
    storage: storage,
    limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
    fileFilter: (req, file, cb) => {
        const filetypes = /pdf|doc|docx|jpg|jpeg|png/;
        const mimetype = filetypes.test(file.mimetype);
        const extname = filetypes.test(path.extname(file.originalname).toLowerCase());
        
        if (mimetype && extname) {
            return cb(null, true);
        }
        cb(new Error('Apenas arquivos PDF, DOC, DOCX, JPG, JPEG ou PNG são permitidos'));
    }
});

function readContracts() {
    try {
        if (!fs.existsSync(DATA_FILE)) {
            fs.writeFileSync(DATA_FILE, '[]');
            return [];
        }
        const data = fs.readFileSync(DATA_FILE, 'utf8');
        return JSON.parse(data || '[]');
    } catch (error) {
        console.error('Erro ao ler contratos', error);
        return [];
    }
}

app.delete('/api/contracts/clean-all', authenticateJWT, requireAdmin, (req, res) => {
    try {
        // 1. Ler os contratos existentes para obter os nomes dos arquivos
        const contracts = readContracts();
        const uploadsDir = path.join(__dirname, 'uploads', 'contracts');

        // 2. Excluir todos os arquivos físicos
        if (fs.existsSync(uploadsDir)) {
            // Primeiro: excluir arquivos listados nos contratos
            contracts.forEach(contract => {
                try {
                    const filePath = path.join(uploadsDir, contract.fileName);
                    if (fs.existsSync(filePath)) {
                        fs.unlinkSync(filePath);
                    }
                } catch (fileError) {
                    console.error(`Erro ao excluir ${contract.fileName}:`, fileError);
                }
            });

            // Segundo: limpar outros arquivos que possam existir na pasta
            fs.readdirSync(uploadsDir).forEach(file => {
                try {
                    fs.unlinkSync(path.join(uploadsDir, file));
                } catch (dirError) {
                    console.error(`Erro ao excluir ${file}:`, dirError);
                }
            });
        }

        // 3. Limpar o arquivo contracts.json de forma atômica
        saveContracts([]);

        // 4. Responder com sucesso
        res.json({ 
            success: true, 
            message: 'Todos os contratos e arquivos foram removidos com sucesso',
            contracts: []
        });
    } catch (error) {
        console.error('Erro ao limpar contratos:', error);
        res.status(500).json({ 
            success: false, 
            error: 'Falha ao remover contratos',
            details: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
});


// Função para carregar contratos do arquivo
function loadContracts() {
    try {
        if (!fs.existsSync(contractsFilePath)) {
            fs.writeFileSync(contractsFilePath, '[]', 'utf8');
            return [];
        }
        const data = fs.readFileSync(contractsFilePath, 'utf8');

        if (!data.trim()) {
            return [];
        } 

        return JSON.parse(data);
    } catch (error) {
        console.error('Erro ao carregar contratos:', error);
        return [];
    }
}

function getContracts() {
    return loadContracts();
}


// Rota para cadastrar novo contrato
app.post('/api/contracts', authenticateJWT, upload.single('file'), (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ 
                success: false,
                error: 'Nenhum arquivo enviado' 
            });
        }
    
        const { type, number, date, description } = req.body;
        
        // Validação básica
        if (!type || !number || !date) {
            return res.status(400).json({ error: 'Campos obrigatórios faltando' });
        }

        // Verifica se a data está dentro do intervalo permitido.
        const contractDate = new Date(date);
        const minDate = new Date('2025-01-01');
        const maxDate = new Date('2040-12-31');
        
        if (Number.isNaN(contractDate.getTime()) || contractDate < minDate || contractDate > maxDate) {
            return res.status(400).json({ 
                error: 'Data do contrato deve estar entre Janeiro/2025 e Dezembro/2040'
            });
        }

        const contracts = getContracts();
    
        const newContract = {
            id: uuidv4(),
            type,
            number,
            date,
            description: description || '',
            fileName: req.file.filename,
            originalName: req.file.originalname,
            filePath: `/uploads/contracts/${req.file.filename}`,
            mimeType: req.file.mimetype,
            createdAt: new Date().toISOString()
        };

        contracts.push(newContract);
        saveContracts(contracts);
    
        res.status(201).json(newContract);
    } catch (error) {
        console.error('Erro ao cadastrar contrato:', error);
        res.status(500).json({ error: 'Erro interno ao processar o contrato' });
    }
});



// Função para salvar contratos no arquivo
function saveContracts(contracts) {
    try {
        const dir = path.dirname(contractsFilePath);
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }
        const tempPath = `${contractsFilePath}.tmp`;
        fs.writeFileSync(tempPath, JSON.stringify(contracts, null, 2), 'utf8');
        const fileDescriptor = fs.openSync(tempPath, 'r+');
        try {
            fs.fsyncSync(fileDescriptor);
        } finally {
            fs.closeSync(fileDescriptor);
        }
        fs.renameSync(tempPath, contractsFilePath);
    } catch (error) {
        console.error('Erro ao salvar contratos:', error);
        throw error;
    }
}


// Rota para listar contratos com filtros
app.get('/api/contracts', authenticateJWT, (req, res) => {
    try {
        let contracts = readContracts();
        const { type, year, search } = req.query;

        // Aplicar filtros
        if (type) {
            contracts = contracts.filter(c => c.type === type);
        }
        
        if (year) {
            contracts = contracts.filter(c => new Date(c.date).getFullYear() == year);
        }
        
        if (search) {
            const searchTerm = search.toLowerCase();
            contracts = contracts.filter(c => 
                c.number.toLowerCase().includes(searchTerm) || 
                (c.description && c.description.toLowerCase().includes(searchTerm))
            );
        }
        
        // Ordenar por data mais recente primeiro
        contracts.sort((a, b) => new Date(b.date) - new Date(a.date));
        
        res.json(contracts);
    } catch (error) {
        res.status(500).json({ error: 'Erro ao listar contratos' });
    }
});

// Rota para obter metadados do contrato
app.get('/api/contracts/:id', authenticateJWT, async (req, res) => {
    try {
        const { id } = req.params;

        if (!id || !uuidv4(id)) { // Corrigido: usando uuidv4.validate
            return res.status(400).json({ error: 'ID do contrato inválido' });
        }

        const contracts = readContracts();
        const contract = contracts.find(c => c.id === id);

        if (!contract) {
            return res.status(404).json({ error: 'Contrato não encontrado' });
        }

        // Retorna os metadados sem o arquivo
        const { fileName, filePath, ...contractData } = contract;
        res.json(contractData);
    } catch (error) {
        console.error('Erro ao buscar contrato:', error);
        res.status(500).json({ error: 'Erro interno ao buscar contrato' });
    }
});


// Rota para download de contrato
app.get('/api/contracts/:id/download', authenticateJWT, async (req, res) => {
    try {
        const { id } = req.params;

        if (!id || !uuidv4(id)) {     // Corrigido: usando uuidv4.validate
            return res.status(400).json({ error: 'ID do contrato inválido'});
        }

        const contracts = readContracts();
        const contract = contracts.find(c => c.id === id);

        if (!contract) {
            return res.status(404).json({ error: 'Contrato não encontrado' });
        }

        const filePath = path.join(uploadsDir, contract.fileName);

        try {
            await fs.promises.access(filePath, fs.constants.R_OK);
        } catch (err) {
            return res.status(404).json({ 
                error: 'Arquivo não encontrado ou sem permissão de leitura'});
        }
            
        const fileStats = await fs.promises.stat(filePath);
        const contentType = mime.lookup(contract.originalName) || 'application/octet-stream';
        const encondedFilename = encodeURIComponent(contract.originalName);

        // Configura headers para forçar download
        res.setHeader('Content-Type', contentType);
        res.setHeader('Content-Disposition', `attachment; filename="${encondedFilename}"; filename*=UTF-8''${encondedFilename}`);
        res.setHeader('Content-Length', fileStats.size);
        res.setHeader('Cache-Control', 'no-store');
        res.setHeader('Accept-Ranges', 'bytes');

        // Stream do arquivo
        const fileStream = fs.createReadStream(filePath);
        fileStream.on('error', (err) => {
            console.error('Erro ao ler arquivo:', err);
            if (!res.headersSent) {
                res.status(500).json({ error: 'Erro ao ler arquivo'});
            }
        });

        fileStream.pipe(res);
    } catch (error) {
        console.error('Erro no endpoint de download:', error);
        if (!res.headersSent) {
            res.status(500).json({ error: 'Erro interno ao processar download' });
        }
    }
});


// Delete de contratos individuais
app.delete('/api/contracts/:id', authenticateJWT, requireAdmin, async (req, res) => {
    try {
        const contracts = readContracts();
        const index = contracts.findIndex(c => c.id === req.params.id);
        
        if (index === -1) {
            return res.status(404).json({ error: 'Contrato não encontrado' });
        }

        // Remove arquivo físico
        const filePath = path.join(uploadsDir, contracts[index].fileName);
        if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
        }

        // Remove do JSON
        contracts.splice(index, 1);
        saveContracts(contracts);

        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: 'Erro ao excluir contrato' });
    }
});

// Rota para visualização de contrato
app.get('/api/contracts/:id/view', authenticateJWT, (req, res) => {
    try {
        const { id } = req.params;
        const contracts = readContracts();
        const contract = contracts.find(c => c.id.toString() === id.toString());

        if (!contract) {
            return res.status(404).send('Contrato não encontrado');
        }

        const filePath = path.join(uploadsDir, contract.fileName);
        if (!fs.existsSync(filePath)) {
            return res.status(404).send('Arquivo não encontrado');
        }

        const extension = path.extname(contract.fileName).toLowerCase();
        const isPdf = extension === '.pdf';

        // Configura os headers para forçar abertura no navegador
        if (isPdf) {
            res.setHeader('Content-Type', 'application/pdf');
            res.setHeader('Content-Disposition', `inline; filename="${encodeURIComponent(contract.originalName)}"`);
            res.setHeader('X-Content-Type-Options', 'nosniff'); // Evita que o navegador ignore o Content-Type
        } else {
            // Lógica para outros tipos de arquivo (imagens, documentos, etc.)
            const contentType = contract.mimeType || 'application/octet-stream';
            res.setHeader('Content-Type', contentType);

            if (contentType.startsWith('image/')) {
                res.setHeader('Content-Disposition', `inline; filename="${encodeURIComponent(contract.originalName)}"`);
            } else {
                res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(contract.originalName)}"`);
            }
        }

        // Envia o arquivo
        const fileStream = fs.createReadStream(filePath, { highWaterMark: 64 * 1024 });
        fileStream.pipe(res);
    } catch (error) {
        console.error('Erro ao visualizar contrato:', error);
        res.status(500).send('Erro ao visualizar contrato');
    }
});


db.serialize(() => {
    db.run(`
        CREATE TABLE IF NOT EXISTS projects (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            code TEXT NOT NULL UNIQUE,
            manager TEXT NOT NULL,
            start_date TEXT NOT NULL,
            end_date TEXT,
            status TEXT NOT NULL,
            description TEXT NOT NULL,
            created_at TEXT DEFAULT CURRENT_TIMESTAMP,
            updated_at TEXT DEFAULT CURRENT_TIMESTAMP
        )
    `);
    
    db.run(`
        CREATE TABLE IF NOT EXISTS project_files (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            project_id INTEGER NOT NULL,
            filename TEXT NOT NULL,
            originalname TEXT NOT NULL,
            mimetype TEXT NOT NULL,
            size INTEGER NOT NULL,
            FOREIGN KEY (project_id) REFERENCES projects (id) ON DELETE CASCADE
        )
    `);
});

const projectsUpload = multer({
    storage: multer.diskStorage({
        destination: (req, file, cb) => {
            const dir = path.join(__dirname, 'uploads/projects');
            fs.mkdirSync(dir, { recursive: true });
            cb(null, dir);
        },
        filename: (req, file, cb) => {
            cb(null, Date.now() + '-' + uuidv4() + path.extname(file.originalname).toLowerCase());
        }
    }),
    limits: { fileSize: 10 * 1024 * 1024 } // 10MB
});

                                                       // PARTE DE PROJETOS // 

// Rotas para projetos
router.post('/projects', authenticateJWT, projectsUpload.array('files'), async (req, res) => {
        try {
        const projectData = JSON.parse(req.body.project);

    const allowedHeaders = ['planejamento', 'andamento', 'suspenso', 'concluido'];
    if (!allowedHeaders.includes(projectData.status)) {
        return res.status(400).json({ success: false, message: 'Status inválido' });
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(projectData.start_date)) {
        return res.status(400).json({ success: false, message: 'Data de início inválida' });
    }

        
        // Validação básica
        if (!projectData.name || !projectData.code || !projectData.manager || !projectData.start_date || !projectData.description) {
            return res.status(400).json({ success: false, message: 'Preencha todos os campos obrigatórios' });
        }
        
        // Insere o projeto no banco de dados
        const result = await new Promise((resolve, reject) => {
            db.run(
                `INSERT INTO projects (name, code, manager, start_date, end_date, status, description) 
                VALUES (?, ?, ?, ?, ?, ?, ?)`,
                [
                    projectData.name,
                    projectData.code,
                    projectData.manager,
                    projectData.start_date,
                    projectData.end_date,
                    projectData.status,
                    projectData.description
                ],
                function(err) {
                    if (err) reject(err);
                    else resolve(this.lastID);
                }
            );
        });
        
        // Processa os arquivos enviados
        if (req.files && req.files.length > 0) {
            console.log('Arquivos recebidos:', req.files);
            for (const file of req.files) {
                const originalName = file.originalname || path.basename(file.originalname);
                console.log('Tentando inserir arquivo no banco:', file.filename);

                await new Promise((resolve, reject) => {
                    db.run(
                        `INSERT INTO project_files (project_id, filename, originalname, mimetype, size) 
                        VALUES (?, ?, ?, ?, ?)`,
                        [
                            result,
                            file.filename,
                            originalName,
                            file.mimetype,
                            file.size
                        ],
                        function(err) {
                            if (err) {
                                console.error('Erro ao inserir arquivo no banco:', err);
                            reject(err);
                        }  else {
                             resolve();
                    }
                }
            );
        });
    }
}
        
        res.json({ success: true, projectId: result });
    } catch (error) {
        if (error.message && error.message.includes('UNIQUE constraint failed: projects.code')) {
            return res.status(400).json({ success: false, message: 'Código do projeto já existe' });
        }
        console.error('Erro ao criar projeto:', error);
        res.status(500).json({ success: false, message: error.message });
    }
});

router.get('/projects', authenticateJWT, async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10;
        const offset = (page - 1) * limit;
        let sql = 'SELECT * FROM projects';
        let params = [];

        // Filtros opcionais
        if (req.query.status) {
            sql += ' WHERE status = ?';
            params.push(req.query.status);
        }
        sql += ' ORDER BY start_date DESC LIMIT ? OFFSET ?';
        params.push(limit, offset);

        const projects = await new Promise((resolve, reject) => {
            db.all(sql, params, (err, rows) => {
                if (err) reject(err);
                else resolve(rows);
            });
        });

        // Para cada projeto, busca os arquivos associados
        for (const project of projects) {
            project.files = await new Promise((resolve, reject) => {
                db.all(
                    'SELECT * FROM project_files WHERE project_id = ?',
                    [project.id],
                    (err, rows) => {
                        if (err) reject(err);
                         else resolve(rows);
                    }
                );
            });
        };
        res.json({ success: true, projects, page, limit });
        } catch (error) {
            console.error('Erro ao buscar projetos:', error);
            res.status(500).json({ success: false, message: error.message });
        }
    });

router.get('/projects/:id', authenticateJWT, async (req, res) => {
    try {
        const project = await new Promise((resolve, reject) => {
            db.get(
                'SELECT * FROM projects WHERE id = ?',
                [req.params.id],
                (err, row) => {
                    if (err) reject(err);
                    else resolve(row);
                }
            );
        });
        
        if (!project) {
            return res.status(404).json({ success: false, message: 'Projeto não encontrado' });
        }
        
        project.files = await new Promise((resolve, reject) => {
            db.all(
                'SELECT * FROM project_files WHERE project_id = ?',
                [req.params.id],
                (err, rows) => {
                    if (err) reject(err);
                    else resolve(rows);
                }
            );
        });
        
        res.json({ success: true, project });
    } catch (error) {
        console.error('Erro ao buscar projeto:', error);
        res.status(500).json({ success: false, message: error.message });
    }
});

router.get('/project-files/:filename', authenticateJWT, async (req, res) => {
    try {
        if (path.basename(req.params.filename) !== req.params.filename) {
            return res.status(400).json({ success: false, message: 'Nome de arquivo inválido' });
        }
        const filePath = path.join(__dirname, 'uploads', 'projects', req.params.filename);

        if (!fs.existsSync(filePath)) {
            return res.status(404).json({ success: false, message: 'Arquivo não encontrado'});
        }
        
        if (req.query.download === '1') {
        return res.download(filePath, req.params.filename);
        }
        res.sendFile(filePath)
    } catch (error) {
        console.error('Erro ao baixar arquivo:', error)
        res.status(500).json({ success: false, message: error.messsage });
    }
});

router.delete('/project-files/:id', authenticateJWT, requireAdmin, async (req, res) => {
    try {
        // Primeiro obtém o arquivo para deletá-lo do sistema de arquivos
        const file = await new Promise((resolve, reject) => {
            db.get(
                'SELECT filename, project_id FROM project_files WHERE id = ?',
                [req.params.id],
                (err, row) => {
                    if (err) reject(err);
                    else resolve(row);
                }
            );
        });

        if (!file) {
            return res.status(404).json({ success: false, message: 'Arquivo não encontrado' });
        }
        // Deleta o arquivo do sistema de arquivos
        const filePath = path.join(__dirname, 'uploads', 'projects', file.filename);
        if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
        }

        // Depois deleta o registro do banco de dados
        await new Promise((resolve, reject) => {
            db.run(
                'DELETE FROM project_files WHERE id = ?',
                [req.params.id],
                function(err) {
                    if (err) reject(err);
                    else resolve();
                }
            );
        });

        res.json({ 
            success: true,
            message: 'Arquivo deletado com sucesso',
            projectId: file.project_id
        });
        return
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});


router.put('/projects/:id', authenticateJWT, projectsUpload.array('files'), async (req, res) => {
        try {
        const projectData = JSON.parse(req.body.project);

    const allowedStatus = ['planejamento', 'andamento', 'suspenso', 'concluido'];
    if (!allowedStatus.includes(projectData.status)) {
        return res.status(400).json({ success: false, message: 'Status inválido' });
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(projectData.start_date)) {
        return res.status(400).json({ success: false, message: 'Data de início inválida' });
    }
        
        // Atualiza o projeto no banco de dados
        await new Promise((resolve, reject) => {
            db.run(
                `UPDATE projects 
                SET name = ?, code = ?, manager = ?, start_date = ?, end_date = ?, status = ?, description = ?, updated_at = CURRENT_TIMESTAMP
                WHERE id = ?`,
                [
                    projectData.name,
                    projectData.code,
                    projectData.manager,
                    projectData.start_date,
                    projectData.end_date,
                    projectData.status,
                    projectData.description,
                    req.params.id
                ],
                function(err) {
                    if (err) reject(err);
                    else resolve();
                }
            );
        });
        
        // Processa os novos arquivos enviados
        if (req.files && req.files.length > 0) {
            for (const file of req.files) {
                const originalName = file.originalname || path.basename(file.originalname);
                
                await new Promise((resolve, reject) => {
                    db.run(
                        `INSERT INTO project_files (project_id, filename, originalname, mimetype, size) 
                        VALUES (?, ?, ?, ?, ?)`,
                        [
                            req.params.id,
                            file.filename,
                            originalName,
                            file.mimetype,
                            file.size
                        ],
                        function(err) {
                            if (err) reject(err);
                            else resolve();
                        }
                    );
                });
            }
        }

        const project = await new Promise((resolve, reject) => {
            db.get(
                'SELECT * FROM projects WHERE id = ?',
                [req.params.id],
                (err, row) => {
                    if (err) reject(err);
                    else resolve(row);
                
            });
        });

        project.files = await new Promise((resolve, reject) => {
            db.all(
                'SELECT * FROM project_files WHERE project_id = ?',
                [req.params.id],
                (err, rows) => {
                    if (err) reject(err);
                    else resolve(rows);
                })
            })
            res.json({ success: true, project });
        } catch (error) {
            console.error('Erro ao atualizar projeto:', error);
            res.status(500).json({ success: false, message: error.message });
    }
});

router.delete('/projects/:id', authenticateJWT, requireAdmin, async (req, res) => {
    try {
        const project = await new Promise((resolve, reject) => {
            db.get('SELECT id FROM projects WHERE id = ?', [req.params.id], (err, row) => {
                if (err) reject(err);
                else resolve(row);
            });
        });
        if (!project) {
            return res.status(404).json({ success: false, message: 'Projeto não encontrado' });
        }

        // Primeiro obtemos os arquivos para deletá-los do sistema de arquivos
        const files = await new Promise((resolve, reject) => {
            db.all(
                'SELECT filename FROM project_files WHERE project_id = ?',
                [req.params.id],
                (err, rows) => {
                    if (err) reject(err);
                    else resolve(rows);
                }
            );
        });
        
        // Deleta os arquivos do sistema de arquivos
        for (const file of files) {
            try {
                const filePath = path.join(__dirname, 'uploads', 'projects', file.filename);
                if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
            } catch (err) {
                console.error('Erro ao deletar arquivo:', err);
            }
        }
        
        // Depois deleta o projeto (os arquivos serão deletados por CASCADE)
        await new Promise((resolve, reject) => {
            db.run(
                'DELETE FROM projects WHERE id = ?',
                [req.params.id],
                function(err) {
                    if (err) reject(err);
                    else resolve();
                }
            );
        });
        
        res.json({ success: true });
    } catch (error) {
        console.error('Erro ao deletar projeto:', error);
        res.status(500).json({ success: false, message: error.message });
    }
});



                                       //  ROTAS PARA IDENTIDADES  //  
    const identitiesStorage = multer.diskStorage({
        destination: (req, file, cb) => {
            const dir = path.join(__dirname, 'uploads', 'identities');
            if (!fs.existsSync(dir)) {
                fs.mkdirSync(dir, { recursive: true });
            }
            cb(null, dir);
        },
        filename: (req, file, cb) => {  
            cb(null, Date.now() + '-' + uuidv4() + path.extname(file.originalname).toLowerCase());
        }
    });
    const identitiesUpload = multer({
        storage: identitiesStorage,
        limits: { fileSize: 5 * 1024 * 1024 }, // 5MB   
    });

    app.post('/api/identities', authenticateJWT, identitiesUpload.single('foto'), (req, res) => {
        console.log('Recebido:', req.body, req.file);
        const {nome, cpf, endereco, perfil} = req.body;
        const foto = req.file ? `/uploads/identities/${req.file.filename}` : null;
        const createdAt = new Date().toISOString().slice(0, 10);
        db.run(
            `INSERT INTO identities (nome, cpf, endereco, perfil, foto, created_at) VALUES (?, ?, ?, ?, ?, ?)`,
            [nome, cpf, endereco, perfil, foto, createdAt],
            function(err) {
                if (err) return res.status(500).json({ success: false, error: err.message });
                res.json({ success: true, id: this.lastID, foto });
            }
        );
    });

    app.get('/api/identities', authenticateJWT, (req, res) => {
        db.all('SELECT * FROM identities', [], (err, rows) => {
            if (err) return res.status(500).json({ success: false, error: err.message });
            res.json(rows);
        });
    });

    app.delete('/api/identities/:id', authenticateJWT, requireAdmin, (req, res) => {
        const id = req.params.id;

        db.get(`SELECT foto FROM identities WHERE id = ?`, [id], (err, row) => {
            if (err) return res.status(500).json({ success: false, error: err.message });
            if (!row) return res.status(404).json({ success: false, message: 'Identidade não encontrada' });

            // Deletar o arquivo físico
            if (row && row.foto) {
                try {
                    if (!/^\/uploads\/identities\/[^/\\]+$/.test(row.foto)) {
                        return res.status(500).json({ success: false, message: 'Caminho da foto inválido' });
                    }
                    const filePath = path.join(__dirname, 'uploads', 'identities', path.basename(row.foto));
                    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
                } catch (fileError) {
                    console.error('Erro ao excluir foto da identidade:', fileError);
                    return res.status(500).json({ success: false, message: 'Erro ao excluir foto da identidade' });
                }
            }
                // Deletar do banco de dados
                db.run(`DELETE FROM identities WHERE id = ?`, [id], function (err) { 
                    if (err) return res.status(500).json({ success: false, message: err.message });
                    res.json({ success: true });
            });
        });
    });


    // ROTA PERFIL  
    app.put('/update-profile', authenticateJWT, async (req, res) => {
    try {
        const { departamento, cargo, cpf } = req.body;
        const username = req.user.username;
        await userRepository.updateProfile(username, departamento, cargo, cpf);
        const user = await userRepository.findByUsername(username);
        res.json({
            success: true,
            message: 'Perfil atualizado com sucesso',
            user: {
                id: user.id,
                username: user.username,
                nome: user.nome,
                email: user.email,
                cpf: user.cpf,
                departamento: user.departamento,
                cargo: user.cargo
            }
        });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Erro ao atualizar perfil' });
    }
});

// Funções de gerenciamento de token
const tokenUtils = {
    // Verifica se o token existe e é válido
    checkToken: () => {
        const token = localStorage.getItem('token');
        if (!token) {
            return { isValid: false, reason: 'Token não encontrado' };
        }
        
        try {
            const decoded = jwt(token);
            const isExpired = decoded.exp < Date.now() / 1000;
            
            return {
                isValid: !isExpired,
                isExpired,
                decoded,
                reason: isExpired ? 'Token expirado' : 'Token válido'
            };
        } catch (e) {
            return { isValid: false, reason: 'Token inválido' };
        }
    },
    
    // Redireciona para login se o token for inválido
    redirectIfInvalid: () => {
        const tokenCheck = tokenUtils.checkToken();
        if (!tokenCheck.isValid) {
            localStorage.removeItem('token');
            window.location.href = '/login.html';
            return false;
        }
        return true;
    },
    
    // Renova o token se estiver perto de expirar
    async renewToken() {
        const tokenCheck = tokenUtils.checkToken();
        if (!tokenCheck.isValid) return false;
        
        // Renova se estiver nos últimos 15 minutos de validade
        const expiresIn = tokenCheck.decoded.exp - (Date.now() / 1000);
        if (expiresIn > 900) return true; // 15 minutos em segundos
        
        try {
            const response = await fetch('http://localhost:3000/api/renew-token', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('token')}`
                }
            });
            
            if (response.ok) {
                const data = await response.json();
                localStorage.setItem('token', data.token);
                return true;
            }
            return false;
        } catch (error) {
            console.error('Erro ao renovar token:', error);
            return false;
        }
    }
};

app.post('/api/renew-token', async (req, res) => {
    try {
        const authHeader = req.headers['authorization'];
        const token = authHeader?.split(' ')[1];
        
        if (!token) {
            return res.status(401).json({ 
                success: false,
                message: 'Token não fornecido' 
            });
        }

        jwt.verify(token, SECRET_KEY, (err, decoded) => {
            if (err) {
                return res.status(403).json({ 
                    success: false,
                    message: 'Token inválido' 
                });
            }
            
            // Cria novo token com os mesmos dados
            const newToken = jwt.sign(
                { userId: decoded.userId, username: decoded.username }, 
                SECRET_KEY, 
                { expiresIn: '8h' }
            );
            
            res.json({ 
                success: true,
                token: newToken 
            });
        });
    } catch (error) {
        res.status(500).json({ 
            success: false,
            message: 'Erro ao renovar token' 
        });
    }
});

app.use((err, req, res, next) => {
    if (err instanceof multer.MulterError) {
        return res.status(400).json({ 
            success: false,
            error: err.code === 'LIMIT_FILE_SIZE' ? 'Arquivo muito grande (máx. 5MB)' : 'Erro no upload'
        });
    }
    next(err);
});

// Middleware de verificação de banco de dados
app.use(async (req, res, next) => {
    try {
        if (!db.open) {
            await initializeDatabase();
        }
        next();
    } catch (error) {
        console.error('Erro na conexão com o banco:', error);
        res.status(503).json({ 
            success: false,
            message: 'Serviço temporariamente indisponível' 
        });
    }
});

// Middleware de log
app.use((req, res, next) => {
    console.log(`${req.method} ${req.url}`);
    next();
});

// Inicialização de diretórios
const initializeDirectories = () => {
    try {
        if (!fs.existsSync(uploadsDir)) {
            fs.mkdirSync(uploadsDir, { recursive: true });
            console.log(`Pasta 'uploads' criada em: ${uploadsDir}`);
        }

        if (!fs.existsSync(contractsFilePath)) {
            fs.writeFileSync(contractsFilePath, '[]', 'utf8');
            console.log(`Arquivo 'contracts.json' criado em: ${contractsFilePath}`);
        }
    } catch (error) {
        console.error('Erro na inicialização de diretórios:', error);
        process.exit(1);
    }
};

const checkedFilePermissions = () => {
    try {
        fs.accessSync(contractsFilePath, fs.constants.R_OK | fs.constants.W_OK);
        console.log('Permissões do arquivo contracts.json verificadas com sucesso');
    } catch (err) {
        console.error('Erro de permissão no arquivo contracts.json:', err);
        try {
            fs.chmodSync(contractsFilePath, 0o666);
            console.log('Permissões do arquivo contracts.json ajustadas');
        } catch (chmodError) {
            console.error('Falha ao ajustar permissões', chmodError);
            process.exit(1);
        }
    }
};

initializeDirectories();
checkedFilePermissions();

// Rotas públicas
app.get('/health', async (req, res) => {
    try {
        const dbStatus = db.open ? 'Conectado' : 'Desconectado';
        res.json({ 
            success: true,
            status: 'Servidor está funcionando',
            dbStatus,
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Erro ao verificar saúde do servidor'
        });
    }
});

const LOGIN_WINDOW_MS = 15 * 60 * 1000;
const MAX_LOGIN_FAILURES = 10;
const loginFailures = new Map();
const nonexistentUserHash = bcrypt.hashSync('invalid-account-placeholder', 10);

function limitLoginAttempts(req, res, next) {
    const key = req.ip;
    const entry = loginFailures.get(key);
    if (entry && entry.expiresAt <= Date.now()) loginFailures.delete(key);

    const activeEntry = loginFailures.get(key);
    if (activeEntry && activeEntry.count >= MAX_LOGIN_FAILURES) {
        res.set('Retry-After', String(Math.ceil((activeEntry.expiresAt - Date.now()) / 1000)));
        return res.status(429).json({ success: false, message: 'Muitas tentativas. Aguarde alguns minutos e tente novamente.' });
    }
    next();
}

function recordLoginFailure(ip) {
    const now = Date.now();
    const entry = loginFailures.get(ip);
    if (!entry || entry.expiresAt <= now) {
        loginFailures.set(ip, { count: 1, expiresAt: now + LOGIN_WINDOW_MS });
    } else {
        entry.count += 1;
    }

    if (loginFailures.size > 1000) {
        for (const [key, value] of loginFailures) {
            if (value.expiresAt <= now) loginFailures.delete(key);
        }
    }
}

app.post('/login', limitLoginAttempts, async (req, res) => {
    try {
        const { username, password } = req.body || {};

        if (typeof username !== 'string' || typeof password !== 'string' ||
            !username.trim() || !password || username.length > 100 || password.length > 1024) {
            return res.status(400).json({
                success: false,
                error: 'missing_fields', 
                message: 'Nome de usuário e senha são obrigatórios'
            });
        }

        const user = await userRepository.findByUsername(username.trim().toLowerCase());
        const isPasswordValid = await bcrypt.compare(password, user?.password || nonexistentUserHash);

        if (!user || !isPasswordValid) {
            recordLoginFailure(req.ip);
            return res.status(401).json({ 
                success: false,
                error: 'invalid_credentials',
                message: 'Usuário ou senha inválidos'
            });
        }

        const token = jwt.sign(
            {   userId: user.id, username: user.username }, 
            SECRET_KEY, 
            { expiresIn: '8h' }
        );

        res.status(200).json({ 
            success: true,
            token,
            message: 'Login realizado com sucesso!', 
            user: {
                id: user.id,
                username: user.username,
                email: user.email,
                nome: user.nome,
                cpf: user.cpf,
                departamento: user.departamento,
                cargo: user.cargo
            }
        });
    } catch (error) {
        console.error('Erro no login:', error);
        res.status(500).json({ 
            success: false,
            message: 'Erro ao fazer login',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
});

app.post('/upload', authenticateJWT, upload.single('file'), (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ 
                success: false,
                error: 'Nenhum arquivo enviado' 
            });
        }

        res.json({
            success: true,
            filename: req.file.filename,
            originalname: req.file.originalname,
            size: req.file.size,
            mimetype: req.file.mimetype,
            path: req.file.path
        });
    } catch (error) {
        console.error('Erro no upload:', error);
        res.status(500).json({ 
            success: false,
            error: 'Erro ao processar upload' 
        });
    }
});

app.get('/download/:filename', authenticateJWT, (req, res) => {
    try {
        const filename = req.params.filename;
        const safePath = path.normalize(filename).replace(/^(\.\.(\/|\\|$))+/, '');
        const filePath = path.join(uploadsDir, safePath);

        if (!path.resolve(filePath).startsWith(path.resolve(uploadsDir))) {
            return res.status(400).json({ 
                success: false,
                error: 'Caminho inválido' 
            });
        }

        if (!fs.existsSync(filePath)) {
            return res.status(404).json({ 
                success: false,
                error: 'Arquivo não encontrado' 
            });
        }

        res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
        res.setHeader('Content-Type', 'application/octet-stream');
        
        const fileStream = fs.createReadStream(filePath);
        fileStream.pipe(res);
        
        fileStream.on('error', () => {
            res.status(500).json({ 
                success: false,
                error: 'Erro ao ler arquivo' 
            });
        });
    } catch (error) {
        res.status(500).json({ 
            success: false,
            error: 'Erro interno no servidor' 
        });
    }
});

router.get('/contracts/check', authenticateJWT, async (req, res) => {
    try {
        const { number } = req.query;
        const contracts = readContracts();
        const exists = contracts.some(c => c.number === number);

        res.json({ exists });
    } catch (error) {
        res.status(500).json({ error: 'Erro ao verificar contrato' });
    }
});

function validarCPF(cpf) {
    cpf = cpf.replace(/[^\d]+/g, '');
    if (cpf.length !== 11) return false;
    if (/^(\d)\1+$/.test(cpf)) return false;
    let soma = 0, resto;
    for (let i = 1; i <= 9; i++) soma += parseInt(cpf.substring(i-1, i)) * (11 - i);
    resto = (soma * 10) % 11;
    if ((resto === 10) || (resto === 11)) resto = 0;
    if (resto !== parseInt(cpf.substring(9, 10))) return false;
    soma = 0;
    for (let i = 1; i <= 10; i++) soma += parseInt(cpf.substring(i-1, i)) * (12 - i);
    resto = (soma * 10) % 11;
    if ((resto === 10) || (resto === 11)) resto = 0;
    if (resto !== parseInt(cpf.substring(10, 11))) return false;
    return true;
}

// Rotas de autenticação
app.post('/register', async (req, res) => {
    try {
        const { nome, cpf, email, username, password, confirmPassword } = req.body;

        const missingFields = [];
        if (!nome) missingFields.push('nome');
        if (!email) missingFields.push('email');
        if (!username) missingFields.push('username');
        if (!password) missingFields.push('password');
        if (!confirmPassword) missingFields.push('confirmPassword');
        if(!cpf) missingFields.push('cpf')
            
            if (missingFields.length > 0) {
                return res.status(400).json({ 
                    success: false,
                    message: 'Campos obrigatórios faltando',
                    missingFields 
                });
            }
            
            if (password !== confirmPassword) {
                return res.status(400).json({ 
                    success: false,
                    message: 'As senhas não coincidem' 
                });
            }
    
            if (!validarCPF(cpf)) {
                return res.status(400).json({
                    success: false,
                    message: 'CPF inválido. Digite um CPF real, apenas números ou com pontos.'
            });
        }

            if (password.length < 8) {
                return res.status(400).json({ 
                    success: false,
                    message: 'Senha deve ter pelo menos 8 caracteres'
                });
            }

        // Verifica se usuário ou email já existem
        const existingUser = await userRepository.findByUsername(username);
        if (existingUser) {
            return res.status(400).json({
                success: false,
                message: 'Nome de usuário já está em uso'
            });
        }

        const existingEmail = await userRepository.findByEmail(email);
        if (existingEmail) {
            return res.status(400).json({
                success: false,
                message: 'E-mail já está em uso'
            });
        }

        const newUser = {
            nome: nome.trim(),
            cpf: cpf.trim(),
            email: email.trim().toLowerCase(),
            username: username.trim().toLowerCase(),
            password: password
        };

        const createdUser = await userRepository.create(newUser);
        
        const token = jwt.sign(
            { userId: createdUser.id, username: createdUser.username }, 
            SECRET_KEY, 
            { expiresIn: '3h' }
        );

        res.status(201).json({ 
            success: true,
            message: 'Usuário criado com sucesso', 
            token,
            user: {
                id: createdUser.id,
                username: createdUser.username,
                email: createdUser.email,
                nome: createdUser.nome,
                cpf: createdUser.cpf
            }
        });
    } catch (error) {
        console.error('Erro no registro:', error);
        res.status(500).json({ 
            success: false,
            message: 'Erro ao processar registro',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
});

app.post('/change-password', authenticateJWT, async (req, res) => {
    try {
        const { currentPassword, newPassword, confirmNewPassword } = req.body;
        const username = req.user.username;

        if (!username || !currentPassword || !newPassword || !confirmNewPassword) {
            return res.status(400).json({ 
                success: false,
                message: 'Todos os campos são obrigatórios' 
            });
        }

        if (newPassword !== confirmNewPassword) {
            return res.status(400).json({ 
                success: false,
                message: 'As novas senhas não coincidem' 
            });
        }

        if (newPassword.length < 8) {
            return res.status(400).json({ 
                success: false,
                message: 'Senha deve ter pelo menos 8 caracteres'
            });
        }

        const user = await userRepository.findByUsername(username);
        if (!user) {
            return res.status(404).json({ 
                success: false,
                message: 'Usuário não encontrado' 
            });
        }

        const isPasswordValid = await bcrypt.compare(currentPassword, user.password);
        if (!isPasswordValid) {
            return res.status(401).json({ 
                success: false,
                message: 'Senha atual incorreta' 
            });
        }

        await userRepository.updatePassword(user.id, newPassword);
        res.json({ 
            success: true,
            message: 'Senha alterada com sucesso' 
        });
    } catch (error) {
        console.error('Erro ao alterar senha:', error);
        res.status(500).json({ 
            success: false,
            message: 'Erro ao alterar senha',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
});

// Middleware de erro + Robusto
app.use((err, req, res, next) => {
    console.error('\n--- ERRO DETECTADO ---');
    console.error('Data:', new Date().toISOString());
    console.error('Rota:', req.originalUrl);
    console.error('Método:', req.method);
    console.error('Erro:', err.message);
    console.error('Stack:', err.stack);
    console.error('----------------------\n');
    
    // Erros específicos do sistema de arquivos
    if (err.code === 'ENOENT') {
        return res.status(500).json({ 
            success: false,
            message: 'Arquivo de dados não encontrado',
            error: process.env.NODE_ENV === 'development' ? err.message : undefined
        });
    }
    
    // Erros de parse JSON
    if (err instanceof SyntaxError && err.status === 400 && 'body' in err) {
        return res.status(400).json({ 
            success: false,
            message: 'JSON inválido no corpo da requisição'
        });
    }
    
    // Erro genérico
    res.status(500).json({ 
        success: false,
        message: 'Erro interno no servidor',
        ...(process.env.NODE_ENV === 'development' && {
            details: err.message,
            stack: err.stack
        })
    });
});


// Iniciar servidor
async function startServer() {
    try {
        await initializeDatabase();
        const server = app.listen(PORT, () => {
            console.log(`Servidor rodando na porta ${PORT}`);
            console.log(`Banco de dados: ${db.open ? 'Conectado' : 'Desconectado'}`);
            console.log(`Teste o endpoint de saúde em: http://localhost:${PORT}/health`);
        });

        server.on('error', (e) => {
            if (e.code === 'EADDRINUSE') {
                console.log(`Porta ${PORT} ocupada, tentando ${PORT + 1}...`);
                setTimeout(() => {
                    server.listen(PORT + 1);
                }, 1000);
            }
        });
    } catch (error) {
        console.error('Falha ao iniciar servidor:', error);
        process.exit(1);
    }
}
startServer();

// Gerenciamento de encerramento
process.on('SIGINT', async () => {
    try {
        await closeDatabase();
        console.log('Servidor encerrado com sucesso');
        process.exit(0);
    } catch (err) {
        console.error('Erro ao encerrar servidor:', err);
        process.exit(1);
    }
});

