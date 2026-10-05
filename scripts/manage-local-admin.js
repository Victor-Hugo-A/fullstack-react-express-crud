const { existsSync } = require('node:fs');
const path = require('node:path');
const readline = require('node:readline/promises');
const sqlite3 = require('../BackEnd/node_modules/sqlite3');

const databasePath = process.env.ADMIN_DB_PATH || path.resolve(__dirname, '..', 'BackEnd', 'database.sqlite');
const revoke = process.argv.includes('--revoke');

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
        throw new Error('Banco local não encontrado. Inicie o back-end antes de configurar um administrador.');
    }

    const prompt = readline.createInterface({ input: process.stdin, output: process.stdout });
    let email;
    try {
        email = (await prompt.question('E-mail da conta cadastrada: ')).trim();
    } finally {
        prompt.close();
    }
    if (!email) {
        console.log('Operação cancelada: nenhum e-mail informado.');
        return;
    }

    const db = new sqlite3.Database(databasePath, sqlite3.OPEN_READWRITE);
    try {
        const column = await query(db, "SELECT name FROM pragma_table_info('users') WHERE name = 'is_admin'", []);
        if (!column) {
            throw new Error('Permissões ainda não inicializadas. Reinicie o back-end e tente novamente.');
        }

        const user = await query(db, 'SELECT id, username, is_admin FROM users WHERE email = ? COLLATE NOCASE', [email]);
        if (!user) {
            console.log('Nenhuma conta encontrada com esse e-mail no banco local.');
            return;
        }

        const newValue = revoke ? 0 : 1;
        if (user.is_admin === newValue) {
            console.log(`A conta ${user.username} já está ${revoke ? 'sem' : 'com'} acesso administrativo.`);
            return;
        }
        const changed = await execute(db,
            `UPDATE users
             SET is_admin = ?,
                 account_status = CASE WHEN ? = 1 THEN 'approved' ELSE account_status END,
                 updated_at = CURRENT_TIMESTAMP
             WHERE id = ?`,
            [newValue, newValue, user.id]
        );
        if (changed !== 1) throw new Error('Não foi possível atualizar a conta.');
        console.log(`Acesso administrativo ${revoke ? 'removido de' : 'concedido a'} ${user.username}.`);
    } finally {
        await new Promise((resolve, reject) => db.close(error => error ? reject(error) : resolve()));
    }
}

main().catch(error => {
    console.error(error.message);
    process.exitCode = 1;
});
