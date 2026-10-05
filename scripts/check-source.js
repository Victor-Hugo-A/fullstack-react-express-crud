const { execFileSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const excludedDirectories = new Set(['node_modules', '.git', '.idea']);

function filesIn(directory, predicate) {
    return fs.readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
        const item = path.join(directory, entry.name);
        if (entry.isDirectory()) return excludedDirectories.has(entry.name) ? [] : filesIn(item, predicate);
        return predicate(item) ? [item] : [];
    });
}

const javascriptFiles = filesIn(root, file => file.endsWith('.js'));
for (const file of javascriptFiles) {
    execFileSync(process.execPath, ['--check', file], { stdio: 'inherit' });
}

const htmlFiles = filesIn(path.join(root, 'FrontEnd'), file => file.endsWith('.html'));
const missingTokens = htmlFiles.filter(file => !fs.readFileSync(file, 'utf8').includes('/FrontEnd/design-tokens.css'));
if (missingTokens.length) {
    throw new Error(`Páginas sem os tokens visuais: ${missingTokens.join(', ')}`);
}

console.log(`Verificação estática concluída: ${javascriptFiles.length} scripts e ${htmlFiles.length} páginas.`);
