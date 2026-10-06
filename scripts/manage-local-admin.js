const { existsSync } = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const readline = require('node:readline/promises');
const sqlite3 = require('../BackEnd/node_modules/sqlite3');
const bcrypt = require('../BackEnd/node_modules/bcryptjs');

const databasePath = process.env.ADMIN_DB_PATH || path.resolve(__dirname, '..', 'BackEnd', 'database.sqlite');
const revoke = process.argv.includes('--revoke');
const create = process.argv.includes('--create');

function query(db, sql, params) {
    return new Promise((resolve, reject) => {
        db.get(sql, params, (error, row) => error ? reject(error) : resolve(row));
    });
}

function execute(db, sql, params) {
    return new Promise((resolve, reject) => {
        db.run(sql, params, function (error) {
            error ? reject(error) : resolve(this.changes);
        });
    });
}

function validCpf(value) {
    const cpf = String(value || '').replace(/\D/g, '');
    if (!/^\d{11}$/.test(cpf) || /^(\d)\1+$/.test(cpf)) return false;
    const digit = (length, factor) => {
        const total = cpf.slice(0, length - 1).split('').reduce((sum, item, index) => sum + Number(item) * (factor - index), 0);
        const result = (total * 10) % 11;
        return result === 10 ? 0 : result;
    };
    return digit(10, 10) === Number(cpf[9]) && digit(11, 11) === Number(cpf[10]);
}

async function askForNewAdmin(prompt) {
    const nome = (await prompt.question('Nome completo: ')).trim();
    const email = (await prompt.question('E-mail: ')).trim().toLowerCase();
    const username = (await prompt.question('Usuário: ')).trim().toLowerCase();
    const cpf = (await prompt.question('CPF: ')).replace(/\D/g, '');
    const departamento = (await prompt.question('Departamento (opcional): ')).trim();
    const cargo = (await prompt.question('Cargo (opcional): ')).trim();
    if (!nome || !email || !username || !cpf) throw new Error('Nome, e-mail, usuário e CPF são obrigatórios.');
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error('Informe um e-mail válido.');
    if (!/^[a-z0-9._-]{3,100}$/i.test(username)) throw new Error('Usuário inválido. Use de 3 a 100 letras, números, ponto, hífen ou sublinhado.');
    if (!validCpf(cpf)) throw new Error('CPF inválido.');
    return { nome, email, username, cpf, departamento, cargo };
}

async function main() {
    if (!existsSync(databasePath)) {
        throw new Error('Banco local não encontrado. Inicie o back-end uma vez antes de configurar um administrador.');
    }

    const prompt = readline.createInterface({ input: process.stdin, output: process.stdout });
    let account;
    let email;
    let db;
    try {
        if (create) {
            account = await askForNewAdmin(prompt);
        } else {
            email = (await prompt.question('E-mail da conta cadastrada: ')).trim();
            if (!email) {
                console.log('Operação cancelada: nenhum e-mail informado.');
                return;
            }
        }

        db = new sqlite3.Database(databasePath, sqlite3.OPEN_READWRITE);
        const column = await query(db, "SELECT name FROM pragma_table_info('users') WHERE name = 'is_admin'", []);
        const roleColumn = await query(db, "SELECT name FROM pragma_table_info('users') WHERE name = 'role'", []);
        if (!column || !roleColumn) throw new Error('Permissões ainda não inicializadas. Reinicie o back-end e tente novamente.');

        if (create) {
            if (await query(db, 'SELECT id FROM users WHERE email = ? COLLATE NOCASE', [account.email])) {
                throw new Error('Já existe uma conta com esse e-mail.');
            }
            if (await query(db, 'SELECT id FROM users WHERE username = ? COLLATE NOCASE', [account.username])) {
                throw new Error('Já existe uma conta com esse usuário.');
            }
            const temporaryPassword = crypto.randomBytes(14).toString('base64url');
            const password = await bcrypt.hash(temporaryPassword, 10);
            await execute(db, `
                INSERT INTO users
                  (id, nome, email, username, password, cpf, departamento, cargo, role, is_admin, account_status, created_at, updated_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'admin', 1, 'approved', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
            `, [crypto.randomUUID(), account.nome, account.email, account.username, password, account.cpf, account.departamento || null, account.cargo || null]);
            console.log(`Administrador ${account.username} criado.`);
            console.log(`Senha inicial (anote agora): ${temporaryPassword}`);
            console.log('Entre no portal e altere a senha no perfil após o primeiro acesso.');
            return;
        }

        const user = await query(db, 'SELECT id, username, is_admin, role FROM users WHERE email = ? COLLATE NOCASE', [email]);
        if (!user) {
            console.log('Nenhuma conta encontrada com esse e-mail. Use --create para criar o primeiro administrador.');
            return;
        }
        const newValue = revoke ? 0 : 1;
        const expectedRole = revoke ? 'editor' : 'admin';
        if (user.is_admin === newValue && user.role === expectedRole) {
            console.log(`A conta ${user.username} já está ${revoke ? 'sem' : 'com'} acesso administrativo.`);
            return;
        }
        const changed = await execute(db,
            `UPDATE users
             SET is_admin = ?,
                 role = ?,
                 account_status = CASE WHEN ? = 1 THEN 'approved' ELSE account_status END,
                 updated_at = CURRENT_TIMESTAMP
             WHERE id = ?`,
            [newValue, expectedRole, newValue, user.id]
        );
        if (changed !== 1) throw new Error('Não foi possível atualizar a conta.');
        console.log(`Acesso administrativo ${revoke ? 'removido de' : 'concedido a'} ${user.username}.`);
    } finally {
        prompt.close();
        if (db) await new Promise((resolve, reject) => db.close(error => error ? reject(error) : resolve()));
    }
}

main().catch(error => {
    console.error(error.message);
    process.exitCode = 1;
});
