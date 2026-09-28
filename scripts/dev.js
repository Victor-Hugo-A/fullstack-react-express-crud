const { spawn } = require('node:child_process');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const children = [
    spawn(process.execPath, ['server.js'], {
        cwd: path.join(root, 'BackEnd'),
        stdio: 'inherit'
    }),
    spawn(process.execPath, [path.join(__dirname, 'serve-front.js')], {
        cwd: root,
        stdio: 'inherit'
    })
];

let stopping = false;
function stop(exitCode = 0) {
    if (stopping) return;
    stopping = true;
    process.exitCode = exitCode;
    for (const child of children) {
        if (child.exitCode === null) child.kill();
    }
}

for (const child of children) {
    child.on('error', error => {
        console.error('Não foi possível iniciar um dos servidores:', error.message);
        stop(1);
    });
    child.on('exit', (code, signal) => {
        if (!stopping) stop(code || (signal ? 1 : 0));
    });
}

process.on('SIGINT', () => stop());
process.on('SIGTERM', () => stop());
