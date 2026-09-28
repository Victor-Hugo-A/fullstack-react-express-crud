const { randomBytes } = require('node:crypto');
const { existsSync } = require('node:fs');
const path = require('node:path');
const readline = require('node:readline/promises');
const sqlite3 = require('../BackEnd/node_modules/sqlite3');
const bcrypt = require('../BackEnd/node_modules/bcryptjs');

const databasePath = process.env.RESET_DB_PATH || path.resolve(__dirname, '..', 'BackEnd', 'database.sqlite');

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

async function main() {
    if (!existsSync(databasePath)) {
        throw new Error('Banco local não encontrado. Inicie o back-end ao menos uma vez antes de redefinir a senha.');
    }

    const prompt = readline.createInterface({ input: process.stdin, output: process.stdout });
    let email;
    try {
        email = (await prompt.question('E-mail cadastrado no projeto: ')).trim();
    } finally {
        prompt.close();
    }
    if (!email) {
        console.log('Operação cancelada: nenhum e-mail informado.');
        return;
    }

    const db = new sqlite3.Database(databasePath, sqlite3.OPEN_READWRITE);
    try {
        const user = await query(db, 'SELECT id, username FROM users WHERE email = ? COLLATE NOCASE', [email]);
        if (!user) {
            console.log('Nenhum cadastro encontrado com esse e-mail neste banco local.');
            return;
        }

        const temporaryPassword = randomBytes(18).toString('base64url');
        const hash = await bcrypt.hash(temporaryPassword, 10);
        const changed = await execute(db,
            'UPDATE users SET password = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
            [hash, user.id]
        );
        if (changed !== 1) throw new Error('O cadastro não pôde ser atualizado.');

        console.log(`Usuário para login: ${user.username}`);
        console.log(`Nova senha temporária: ${temporaryPassword}`);
        console.log('Guarde a senha agora e altere-a em Perfil após entrar.');
    } finally {
        await new Promise((resolve, reject) => db.close(error => error ? reject(error) : resolve()));
    }
}

main().catch(error => {
    console.error(error.message);
    process.exitCode = 1;
});
