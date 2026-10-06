const config = require('./config');
const PORT = config.port;
const SECRET_KEY = config.jwtSecret;
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
const { db, userRepository, auditRepository, initializeDatabase, closeDatabase } = require('./database');
const app = express();
const router = express.Router();
const contractsRepository = require('./repositories/contracts.repository');
const { createContractsService } = require('./services/contracts.service');
const { createContractsRouter } = require('./routes/contracts.routes');
const { errorHandler } = require('./middlewares/error-handler');
const { createProjectsRepository } = require('./repositories/projects.repository');
const { createProjectsService } = require('./services/projects.service');
const { createProjectsRouter } = require('./routes/projects.routes');
const { createIdentitiesRepository } = require('./repositories/identities.repository');
const { createIdentitiesService } = require('./services/identities.service');
const { createIdentitiesRouter } = require('./routes/identities.routes');
const mime = require('mime-types');
const compression = require('compression'); // npm install compression
const helmet = require('helmet');
const cookieParser = require('cookie-parser');
const crypto = require('node:crypto');
const { count } = require('console');
app.use(compression()); // Ativa compressão globalmente

if (config.isProduction) app.set('trust proxy', 1);
app.use(helmet({
    crossOriginResourcePolicy: { policy: 'same-site' },
    contentSecurityPolicy: {
        directives: {
            defaultSrc: ["'none'"],
            frameAncestors: ["'none'"],
            baseUri: ["'none'"],
            formAction: ["'self'"],
            scriptSrc: ["'none'"],
            styleSrc: ["'none'"],
            imgSrc: ["'self'", 'data:', 'blob:']
        }
    }
}));
app.use(cookieParser());

const corsOptions = {
    origin: config.allowedOrigins,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-CSRF-Token'],
    credentials: true,
    optionsSuccessStatus: 200
};
app.use(cors(corsOptions));
app.use('/uploads', authenticateJWT, express.static(path.join(__dirname, 'uploads')));

// CONFIG KEYCLOAK
const keycloakRuntimeConfig = {
  keycloak: {
    logoutRedirect: `${config.frontendOrigin}/login.html`,
    frontendUrl: config.frontendOrigin,
    keycloakUrl: process.env.KEYCLOAK_URL || 'http://localhost:8080',
    realm: process.env.KEYCLOAK_REALM || 'meu-realm',
    clientId: process.env.KEYCLOAK_CLIENT_ID || 'nodejs-app'
  },
  session: {
    secret: config.sessionSecret,
    resave: false,
    saveUninitialized: true,
    store: keycloak.memoryStore,
    cookie: { secure: config.isProduction, sameSite: 'lax', httpOnly: true }
  }
};

app.use(session(keycloakRuntimeConfig.session));
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
      secure: config.isProduction,
      sameSite: 'lax',
      maxAge: 3600000 // 1 hora
    });
    
    res.redirect(`${keycloakRuntimeConfig.keycloak.frontendUrl}/Sistema/sistema.html`);
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
      client_id: keycloakRuntimeConfig.keycloak.clientId,
      redirect_uri: `${keycloakRuntimeConfig.keycloak.frontendUrl}/Sistema/sistema.html`,
      response_type: 'code',
      scope: 'openid',
      state: crypto.randomUUID(), // Gera um state único
      nonce: crypto.randomUUID(), // Gera um nonce único
      response_mode: 'fragment',
      // PKCE (Opcional mas recomendado)
      code_challenge_method: 'S256',
      code_challenge: 'gerar-um-code-challenge-valido' // Substitua por um valor real
    });

    const keycloakLoginUrl = `${keycloakRuntimeConfig.keycloak.keycloakUrl}/realms/${encodeURIComponent(keycloakRuntimeConfig.keycloak.realm)}/protocol/openid-connect/auth?${loginParams.toString()}`;

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
const contractsService = createContractsService({ uploadsDir });

if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
}

app.use('/projects/files', authenticateJWT, express.static(path.join(__dirname, 'uploads', 'projects')));
app.use('/project-files', authenticateJWT, express.static(path.join(__dirname, 'uploads', 'projects')));

// Middlewares
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(auditMutationMiddleware);

// Adicionar o router ao app
app.use('/api', router);

function issueAuthCookies(res, token) {
    const csrfToken = crypto.randomBytes(32).toString('base64url');
    res.cookie(config.authCookieName, token, config.cookieOptions);
    res.cookie(config.csrfCookieName, csrfToken, config.csrfCookieOptions);
}

function clearAuthCookies(res) {
    const options = { path: '/', secure: config.cookieOptions.secure, sameSite: config.cookieOptions.sameSite };
    res.clearCookie(config.authCookieName, options);
    res.clearCookie(config.csrfCookieName, options);
}

function validCsrfToken(req) {
    const cookieToken = req.cookies?.[config.csrfCookieName];
    const headerToken = req.get('X-CSRF-Token');
    if (typeof cookieToken !== 'string' || typeof headerToken !== 'string') return false;
    const cookieValue = Buffer.from(cookieToken);
    const headerValue = Buffer.from(headerToken);
    return cookieValue.length === headerValue.length && crypto.timingSafeEqual(cookieValue, headerValue);
}

// Protege recursos privados pela sessão armazenada em cookie HttpOnly.
function authenticateJWT(req, res, next) {
    const token = req.cookies?.[config.authCookieName];
    if (!token) {
        return res.status(401).json({
            success: false,
            message: 'Sessão de acesso não fornecida'
        });
    }

    jwt.verify(token, SECRET_KEY, (err, user) => {
        if (err) {
            return res.status(401).json({
                success: false,
                message: 'Sessão inválida ou expirada'
            });
        }
        if (!['GET', 'HEAD', 'OPTIONS'].includes(req.method) && !validCsrfToken(req)) {
            return res.status(403).json({ success: false, message: 'Token CSRF ausente ou inválido.' });
        }
        req.user = user;
        return next();
    });
}


async function requireAdmin(req, res, next) {
    try {
        const user = await userRepository.findById(req.user.userId);
        if (!user || user.role !== 'admin') {
            return res.status(403).json({
                success: false,
                message: 'Acesso permitido apenas a administradores'
            });
        }
        return next();
    } catch (error) {
        return next(error);
    }
}

const ROLE_PERMISSIONS = Object.freeze({
    viewer: new Set(),
    editor: new Set(['contracts:write', 'projects:write', 'identities:write']),
    admin: new Set(['*'])
});

function permissionsForRole(role) {
    return ROLE_PERMISSIONS[role] || ROLE_PERMISSIONS.viewer;
}

function requirePermission(permission) {
    return async (req, res, next) => {
        try {
            const user = await userRepository.findById(req.user.userId);
            const permissions = permissionsForRole(user?.role);
            if (!user || (!permissions.has('*') && !permissions.has(permission))) {
                return res.status(403).json({
                    success: false,
                    message: 'Seu perfil não possui permissão para realizar esta ação.'
                });
            }
            req.accessRole = user.role;
            return next();
        } catch (error) {
            return next(error);
        }
    };
}

function getAuditEntity(pathname) {
    if (/^\/api\/admin\/users(?:\/|$)/.test(pathname) || pathname === '/update-profile' || pathname === '/change-password') {
        return 'user';
    }
    if (/^\/api\/contracts(?:\/|$)/.test(pathname)) return 'contract';
    if (/^\/api\/projects(?:\/|$)/.test(pathname) || /^\/api\/project-files(?:\/|$)/.test(pathname)) return 'project';
    if (/^\/api\/identities(?:\/|$)/.test(pathname)) return 'identity';
    if (pathname === '/upload') return 'file';
    return null;
}

function auditMutationMiddleware(req, res, next) {
    const pathname = req.path;
    const entity = getAuditEntity(pathname);
    const method = req.method.toUpperCase();
    const isAccountDecision = /^\/api\/admin\/users\/[^/]+\/(?:approve|reject)$/.test(pathname);
    let events = [];

    if (pathname === '/api/admin/users' && method === 'POST') {
        events = [{ action: 'create_account', entity: 'user' }];
    } else if (isAccountDecision && method === 'POST') {
        events = [{ action: pathname.endsWith('/approve') ? 'approve_account' : 'reject_account', entity: 'user' }];
    } else if (entity && ['PUT', 'PATCH'].includes(method)) {
        events = [{ action: 'update', entity }];
    } else if (entity && method === 'DELETE') {
        events = [{ action: 'delete', entity }];
    } else if (entity && method === 'POST' && entity !== 'user' &&
        pathname !== '/api/contracts/sync') {
        events = [{ action: 'upload', entity }];
    }

    if (events.length) {
        const originalJson = res.json.bind(res);
        res.json = body => {
            if (body && typeof body === 'object') {
                req.auditEntityId = body.id || body.projectId || body.contract?.id ||
                    body.project?.id || body.identity?.id || body.user?.id || req.auditEntityId;
            }
            return originalJson(body);
        };

        res.once('finish', () => {
            if (res.statusCode < 200 || res.statusCode >= 400) return;
            if (method === 'POST' && events.some(event => event.action === 'upload') &&
                !req.file && !(Array.isArray(req.files) && req.files.length)) {
                return;
            }
            const completedEvents = [...events];
            if (['PUT', 'PATCH'].includes(method) && (req.file || (Array.isArray(req.files) && req.files.length))) {
                completedEvents.push({ action: 'upload', entity });
            }
            const routeId = pathname.match(/^\/api\/(?:admin\/users|contracts|projects|project-files|identities)\/([^/]+)/)?.[1];
            const userId = req.user?.userId || null;
            for (const event of completedEvents) {
                auditRepository.create({
                    userId,
                    action: event.action,
                    entity: event.entity,
                    entityId: req.auditEntityId || routeId || userId,
                    ipAddress: req.ip,
                    requestOrigin: req.get('origin') || req.get('referer'),
                    userAgent: req.get('user-agent')
                }).catch(error => console.error('Falha ao registrar evento de auditoria:', error));
            }
        });
    }
    next();
}

router.get('/admin/users/pending', authenticateJWT, requireAdmin, async (req, res, next) => {
    try {
        const users = await userRepository.getPending();
        res.json({ success: true, users });
    } catch (error) {
        next(error);
    }
});

router.get('/admin/users', authenticateJWT, requireAdmin, async (req, res, next) => {
    try {
        const users = await userRepository.getAll();
        return res.json({ success: true, users });
    } catch (error) {
        return next(error);
    }
});

router.post('/admin/users', authenticateJWT, requireAdmin, async (req, res, next) => {
    try {
        const { nome, cpf, email, username, password, confirmPassword, departamento, cargo, role = 'viewer' } = req.body || {};
        const missingFields = ['nome', 'cpf', 'email', 'username', 'password', 'confirmPassword']
            .filter(field => !String(req.body?.[field] || '').trim());
        if (missingFields.length) {
            return res.status(400).json({
                success: false,
                error: 'missing_fields',
                message: 'Preencha os campos obrigatórios para criar a conta.',
                missingFields
            });
        }
        if (String(password).length < 8) {
            return res.status(400).json({ success: false, error: 'weak_password', message: 'A senha deve ter ao menos 8 caracteres.' });
        }
        if (password !== confirmPassword) {
            return res.status(400).json({ success: false, error: 'password_mismatch', message: 'As senhas não coincidem.' });
        }
        if (!validarCPF(String(cpf))) {
            return res.status(400).json({ success: false, error: 'invalid_cpf', message: 'CPF inválido.' });
        }
        const normalizedCpf = String(cpf).replace(/\D/g, '');

        const normalizedUsername = String(username).trim().toLowerCase();
        const normalizedEmail = String(email).trim().toLowerCase();
        if (normalizedUsername.length < 3 || normalizedUsername.length > 100 || !/^[a-z0-9._-]+$/i.test(normalizedUsername)) {
            return res.status(400).json({ success: false, error: 'invalid_username', message: 'Informe um usuário entre 3 e 100 caracteres, usando letras, números, ponto, hífen ou sublinhado.' });
        }
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
            return res.status(400).json({ success: false, error: 'invalid_email', message: 'Informe um e-mail válido.' });
        }
        if (!Object.hasOwn(ROLE_PERMISSIONS, role)) {
            return res.status(400).json({ success: false, error: 'invalid_role', message: 'Perfil de acesso inválido.' });
        }
        if (await userRepository.findByUsername(normalizedUsername)) {
            return res.status(409).json({ success: false, error: 'username_in_use', message: 'Nome de usuário já está em uso.' });
        }
        if (await userRepository.findByEmail(normalizedEmail)) {
            return res.status(409).json({ success: false, error: 'email_in_use', message: 'E-mail já está em uso.' });
        }
        if (await userRepository.findByCpf(normalizedCpf)) {
            return res.status(409).json({ success: false, error: 'cpf_in_use', message: 'CPF já está vinculado a outra conta.' });
        }

        const user = await userRepository.create({
            nome: String(nome).trim(),
            cpf: normalizedCpf,
            email: normalizedEmail,
            username: normalizedUsername,
            password,
            departamento: String(departamento || '').trim(),
            cargo: String(cargo || '').trim(),
            role,
            account_status: 'approved'
        });
        return res.status(201).json({
            success: true,
            message: 'Conta criada e liberada para acesso.',
            user: {
                id: user.id,
                nome: user.nome,
                email: user.email,
                username: user.username,
                cpf: user.cpf,
                departamento: user.departamento,
                cargo: user.cargo,
                role: user.role,
                accountStatus: user.account_status
            }
        });
    } catch (error) {
        next(error);
    }
});

router.put('/admin/users/:id', authenticateJWT, requireAdmin, async (req, res, next) => {
    try {
        const { nome, cpf, departamento, cargo, role } = req.body || {};
        const target = await userRepository.findById(req.params.id);
        if (!target) {
            return res.status(404).json({ success: false, error: 'user_not_found', message: 'Usuário não encontrado.' });
        }
        if (!String(nome || '').trim()) {
            return res.status(400).json({ success: false, error: 'missing_name', message: 'Informe o nome da pessoa.' });
        }
        if (!Object.hasOwn(ROLE_PERMISSIONS, role)) {
            return res.status(400).json({ success: false, error: 'invalid_role', message: 'Perfil de acesso inválido.' });
        }
        const normalizedCpf = String(cpf ?? target.cpf).replace(/\D/g, '');
        if (!validarCPF(normalizedCpf)) {
            return res.status(400).json({ success: false, error: 'invalid_cpf', message: 'CPF inválido.' });
        }
        if (await userRepository.findByCpf(normalizedCpf, target.id)) {
            return res.status(409).json({ success: false, error: 'cpf_in_use', message: 'CPF já está vinculado a outra conta.' });
        }
        if (target.id === req.user.userId && role !== 'admin') {
            return res.status(400).json({ success: false, error: 'self_role_change', message: 'Use outro administrador para alterar seu próprio perfil.' });
        }
        if (target.role === 'admin' && role !== 'admin' && await userRepository.countAdministrators() <= 1) {
            return res.status(409).json({ success: false, error: 'last_administrator', message: 'Mantenha ao menos um administrador ativo no portal.' });
        }
        await userRepository.updateAdminDetails(target.id, {
            nome: String(nome).trim(),
            cpf: normalizedCpf,
            departamento: String(departamento || '').trim(),
            cargo: String(cargo || '').trim(),
            role
        });
        const user = await userRepository.findById(target.id);
        return res.json({
            success: true,
            message: 'Dados e permissões atualizados.',
            user: {
                id: user.id, nome: user.nome, email: user.email, username: user.username, cpf: user.cpf,
                departamento: user.departamento, cargo: user.cargo, role: user.role,
                accountStatus: user.account_status, isAdmin: user.role === 'admin'
            }
        });
    } catch (error) {
        return next(error);
    }
});

router.post('/admin/users/:id/approve', authenticateJWT, requireAdmin, async (req, res, next) => {
    try {
        const changed = await userRepository.setPendingStatus(req.params.id, 'approved');
        if (!changed) {
            const user = await userRepository.findById(req.params.id);
            return res.status(user ? 409 : 404).json({
                success: false,
                error: user ? 'account_not_pending' : 'user_not_found',
                message: user ? 'A conta não está aguardando aprovação.' : 'Usuário não encontrado.'
            });
        }
        return res.json({ success: true, message: 'Conta aprovada com sucesso.' });
    } catch (error) {
        next(error);
    }
});

router.post('/admin/users/:id/reject', authenticateJWT, requireAdmin, async (req, res, next) => {
    try {
        const changed = await userRepository.setPendingStatus(req.params.id, 'rejected');
        if (!changed) {
            const user = await userRepository.findById(req.params.id);
            return res.status(user ? 409 : 404).json({
                success: false,
                error: user ? 'account_not_pending' : 'user_not_found',
                message: user ? 'A conta não está aguardando aprovação.' : 'Usuário não encontrado.'
            });
        }
        return res.json({ success: true, message: 'Solicitação de conta rejeitada.' });
    } catch (error) {
        next(error);
    }
});

router.get('/admin/audit', authenticateJWT, requireAdmin, async (req, res, next) => {
    try {
        const requestedLimit = Number.parseInt(req.query.limit, 10);
        const limit = Number.isInteger(requestedLimit) ? Math.min(Math.max(requestedLimit, 1), 500) : 200;
        const events = await auditRepository.list(limit);
        return res.json({ success: true, events });
    } catch (error) {
        next(error);
    }
});

// Resumo único para a página inicial do dashboard. Evita que a interface faça
// várias requisições independentes para montar a mesma visão.
router.get('/dashboard/summary', authenticateJWT, async (req, res) => {
    const queryAll = (sql, params = []) => new Promise((resolve, reject) => {
        db.all(sql, params, (error, rows) => error ? reject(error) : resolve(rows));
    });

    try {
        const contracts = await contractsRepository.list({});
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
        // Compara somente a parte de data para aceitar registros antigos e novos com horário.
        const datePart = `substr(${field}, 1, 10)`;
        if (from) { clauses.push(`${datePart} >= ?`); params.push(from); }
        if (to) { clauses.push(`${datePart} <= ?`); params.push(to); }
        return { where: clauses.length ? ` WHERE ${clauses.join(' AND ')}` : '', params };
    };

    try {
        const contracts = (await contractsRepository.listByDateRange(from, to)).filter(contract => {
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


app.get('/api/user', authenticateJWT, async (req, res) => {
    try {
        const user = await userRepository.findById(req.user.userId);
        if (!user) return res.status(404).json({ success: false, message: 'Usuário não encontrado' });
        return res.json({
            success: true,
            user: {
                id: user.id,
                username: user.username,
                nome: user.nome || user.username,
                email: user.email,
                cpf: user.cpf,
                departamento: user.departamento,
                cargo: user.cargo,
                role: user.role,
                permissions: [...permissionsForRole(user.role)],
                isAdmin: user.role === 'admin'
            }
        });
    } catch (error) {
        console.error('Erro geral no endpoint:', error);
        return res.status(500).json({
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
        const filetypes = /^(application\/pdf|application\/msword|application\/vnd\.openxmlformats-officedocument\.wordprocessingml\.document|image\/jpeg|image\/png)$/;
        const mimetype = filetypes.test(file.mimetype);
        const extname = uploadPolicies.contract.has(path.extname(file.originalname).toLowerCase());
        
        if (mimetype && extname) {
            return cb(null, true);
        }
        const error = new Error('Apenas arquivos PDF, DOC, DOCX, JPG, JPEG ou PNG são permitidos.');
        error.status = 400;
        error.code = 'unsupported_media_type';
        cb(error);
    }
});

const uploadPolicies = {
    contract: new Set(['.pdf', '.doc', '.docx', '.jpg', '.jpeg', '.png']),
    project: new Set(['.pdf', '.doc', '.docx', '.xls', '.xlsx', '.jpg', '.jpeg', '.png']),
    identity: new Set(['.jpg', '.jpeg', '.png'])
};

function detectedFileType(buffer) {
    if (buffer.subarray(0, 5).toString('ascii') === '%PDF-') return 'pdf';
    if (buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return 'png';
    if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) return 'jpeg';
    if (buffer.subarray(0, 8).equals(Buffer.from([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]))) return 'office-legacy';
    if (buffer.subarray(0, 4).equals(Buffer.from([0x50, 0x4b, 0x03, 0x04]))) return 'office-zip';
    return null;
}

function signatureMatchesExtension(extension, type) {
    const expected = {
        '.pdf': ['pdf'], '.png': ['png'], '.jpg': ['jpeg'], '.jpeg': ['jpeg'],
        '.doc': ['office-legacy'], '.xls': ['office-legacy'],
        '.docx': ['office-zip'], '.xlsx': ['office-zip']
    };
    return expected[extension]?.includes(type) || false;
}

async function removeRejectedUploads(files) {
    for (const file of files) {
        if (!file?.path) continue;
        try {
            await fs.promises.unlink(file.path);
        } catch (error) {
            if (error.code !== 'ENOENT') throw error;
        }
    }
}

function validateUploadedFiles(policyName) {
    return async (req, res, next) => {
        const files = [...(req.file ? [req.file] : []), ...(req.files || [])];
        if (!files.length) return next();
        try {
            const allowedExtensions = uploadPolicies[policyName];
            for (const file of files) {
                const extension = path.extname(file.originalname).toLowerCase();
                const sample = Buffer.alloc(16);
                const handle = await fs.promises.open(file.path, 'r');
                try {
                    await handle.read(sample, 0, sample.length, 0);
                } finally {
                    await handle.close();
                }
                const validIdentityMime = policyName !== 'identity' ||
                    file.mimetype === (extension === '.png' ? 'image/png' : 'image/jpeg');
                if (!allowedExtensions?.has(extension) || !validIdentityMime ||
                    !signatureMatchesExtension(extension, detectedFileType(sample))) {
                    await removeRejectedUploads(files);
                    const error = new Error('Arquivo rejeitado: a extensão e o conteúdo não correspondem a um formato permitido.');
                    error.status = 400;
                    error.code = 'invalid_file_signature';
                    return next(error);
                }
            }
            return next();
        } catch (error) {
            try {
                await removeRejectedUploads(files);
            } catch (cleanupError) {
                return next(cleanupError);
            }
            return next(error);
        }
    };
}

app.use('/api', createContractsRouter({
    authenticateJWT,
    requireAdmin,
    requirePermission,
    upload,
    validateUploadedFiles,
    service: contractsService
}));

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

const projectsUploadDir = path.join(__dirname, 'uploads', 'projects');
const projectsUpload = multer({
    storage: multer.diskStorage({
        destination: (req, file, cb) => {
            fs.mkdirSync(projectsUploadDir, { recursive: true });
            cb(null, projectsUploadDir);
        },
        filename: (req, file, cb) => {
            cb(null, Date.now() + '-' + uuidv4() + path.extname(file.originalname).toLowerCase());
        }
    }),
    limits: { fileSize: 10 * 1024 * 1024, files: 5 } // 10MB por arquivo, até 5 anexos
});

const projectsRepository = createProjectsRepository(db);
const projectsService = createProjectsService({ repository: projectsRepository, uploadsDir: projectsUploadDir });
app.use('/api', createProjectsRouter({
    authenticateJWT,
    requireAdmin,
    requirePermission,
    upload: projectsUpload,
    validateUploadedFiles,
    service: projectsService
}));

const identitiesUploadDir = path.join(__dirname, 'uploads', 'identities');
const identitiesUpload = multer({
    storage: multer.diskStorage({
        destination: (req, file, cb) => {
            fs.mkdirSync(identitiesUploadDir, { recursive: true });
            cb(null, identitiesUploadDir);
        },
        filename: (req, file, cb) => {
            cb(null, Date.now() + '-' + uuidv4() + path.extname(file.originalname).toLowerCase());
        }
    }),
    limits: { fileSize: 5 * 1024 * 1024 }
});
const identitiesRepository = createIdentitiesRepository(db);
const identitiesService = createIdentitiesService({
    repository: identitiesRepository,
    uploadsDir: identitiesUploadDir
});
app.use('/api', createIdentitiesRouter({
    authenticateJWT,
    requireAdmin,
    requirePermission,
    upload: identitiesUpload,
    validateUploadedFiles,
    service: identitiesService
}));


    // ROTA PERFIL  
    app.put('/update-profile', authenticateJWT, async (req, res) => {
    try {
        const { departamento, cargo, cpf } = req.body;
        const username = req.user.username;
        const currentUser = await userRepository.findByUsername(username);
        const normalizedCpf = String(cpf || '').replace(/\D/g, '');
        if (!validarCPF(normalizedCpf)) {
            return res.status(400).json({ success: false, error: 'invalid_cpf', message: 'CPF inválido.' });
        }
        if (await userRepository.findByCpf(normalizedCpf, currentUser?.id)) {
            return res.status(409).json({ success: false, error: 'cpf_in_use', message: 'CPF já está vinculado a outra conta.' });
        }
        await userRepository.updateProfile(username, departamento, cargo, normalizedCpf);
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
                cargo: user.cargo,
                role: user.role,
                isAdmin: user.role === 'admin'
            }
        });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Erro ao atualizar perfil' });
    }
});

app.post('/api/renew-token', authenticateJWT, (req, res) => {
    const token = jwt.sign(
        { userId: req.user.userId, username: req.user.username },
        SECRET_KEY,
        { expiresIn: '8h' }
    );
    issueAuthCookies(res, token);
    res.json({ success: true });
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

async function auditLogin(req, user, outcome) {
    await auditRepository.create({
        userId: user?.id,
        action: 'login',
        entity: 'user',
        entityId: user?.id,
        outcome,
        ipAddress: req.ip,
        requestOrigin: req.get('origin') || req.get('referer'),
        userAgent: req.get('user-agent')
    });
}

async function limitLoginAttempts(req, res, next) {
    const key = req.ip;
    const entry = loginFailures.get(key);
    if (entry && entry.expiresAt <= Date.now()) loginFailures.delete(key);

    const activeEntry = loginFailures.get(key);
    if (activeEntry && activeEntry.count >= MAX_LOGIN_FAILURES) {
        res.set('Retry-After', String(Math.ceil((activeEntry.expiresAt - Date.now()) / 1000)));
        try {
            await auditLogin(req, null, 'rate_limited');
        } catch (error) {
            return next(error);
        }
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
            await auditLogin(req, user, 'failed');
            return res.status(401).json({ 
                success: false,
                error: 'invalid_credentials',
                message: 'Usuário ou senha inválidos'
            });
        }

        if (user.account_status !== 'approved') {
            await auditLogin(req, user, 'denied');
            const isPending = user.account_status === 'pending';
            return res.status(403).json({
                success: false,
                error: isPending ? 'account_pending' : 'account_rejected',
                message: isPending
                    ? 'Sua conta aguarda aprovação administrativa.'
                    : 'O acesso desta conta não foi aprovado.'
            });
        }

        await auditLogin(req, user, 'success');

        const token = jwt.sign(
            {   userId: user.id, username: user.username }, 
            SECRET_KEY, 
            { expiresIn: '8h' }
        );
        issueAuthCookies(res, token);

        res.status(200).json({ 
            success: true,
            message: 'Login realizado com sucesso!', 
            user: {
                id: user.id,
                username: user.username,
                email: user.email,
                nome: user.nome,
                cpf: user.cpf,
                departamento: user.departamento,
                cargo: user.cargo,
                role: user.role,
                isAdmin: user.role === 'admin'
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

app.post('/api/logout', authenticateJWT, (req, res) => {
    clearAuthCookies(res);
    res.status(204).end();
});

app.post('/upload', authenticateJWT, requirePermission('contracts:write'), upload.single('file'), validateUploadedFiles('contract'), (req, res) => {
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

app.use(errorHandler);

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
