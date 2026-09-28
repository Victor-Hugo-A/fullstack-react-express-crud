const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const net = require('node:net');
const crypto = require('node:crypto');
const { spawn } = require('node:child_process');

function freePort() {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const port = server.address().port;
      server.close(() => resolve(port));
    });
  });
}

async function waitForHealth(url, processHandle, getOutput) {
  for (let attempt = 0; attempt < 150; attempt++) {
    if (processHandle.exitCode !== null) {
      throw new Error('A API encerrou antes de responder ao teste de saúde: ' + getOutput());
    }
    try {
      const response = await fetch(url);
      if (response.ok) return;
    } catch {
      // O servidor ainda está iniciando.
    }
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  throw new Error('A API não iniciou dentro do prazo: ' + getOutput());
}

test('autenticação, permissões e perfil em banco isolado', async () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'crud-smoke-'));
  const port = await freePort();
  const backendDir = path.resolve(__dirname, '..');
  const sqlite3 = require(path.join(backendDir, 'node_modules', 'sqlite3'));
  for (const file of ['server.js', 'database.js', 'keycloak-config.js']) {
    fs.copyFileSync(path.join(backendDir, file), path.join(tempDir, file));
  }
  fs.writeFileSync(path.join(tempDir, '.env'), [
    `PORT=${port}`,
    `SECRET_KEY=${crypto.randomBytes(32).toString('hex')}`,
    `SESSION_SECRET=${crypto.randomBytes(32).toString('hex')}`
  ].join('\n'));

  // Simula o banco de uma instalação anterior, ainda sem a coluna de administrador.
  const oldDatabase = new sqlite3.Database(path.join(tempDir, 'database.sqlite'));
  await new Promise((resolve, reject) => oldDatabase.exec(`
    CREATE TABLE users (
      id TEXT PRIMARY KEY,
      nome TEXT NOT NULL,
      email TEXT UNIQUE NOT NULL,
      username TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      cpf TEXT NOT NULL,
      departamento TEXT,
      cargo TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `, error => error ? reject(error) : resolve()));
  await new Promise((resolve, reject) => oldDatabase.close(error => error ? reject(error) : resolve()));

  async function manageAdmin(email, revoke = false) {
    const script = path.resolve(backendDir, '..', 'scripts', 'manage-local-admin.js');
    const args = revoke ? [script, '--revoke'] : [script];
    const child = spawn(process.execPath, args, {
      env: { ...process.env, ADMIN_DB_PATH: path.join(tempDir, 'database.sqlite') },
      windowsHide: true,
      stdio: ['pipe', 'pipe', 'pipe']
    });
    let output = '';
    child.stdout.on('data', chunk => { output += chunk.toString(); });
    child.stderr.on('data', chunk => { output += chunk.toString(); });
    child.stdin.end(`${email}\n`);
    const exitCode = await new Promise((resolve, reject) => {
      child.once('error', reject);
      child.once('close', resolve);
    });
    assert.equal(exitCode, 0, output);
  }

  const processHandle = spawn(process.execPath, ['server.js'], {
    cwd: tempDir,
    env: { ...process.env, NODE_PATH: path.join(backendDir, 'node_modules') },
    windowsHide: true,
    stdio: ['ignore', 'pipe', 'pipe']
  });
  let serverOutput = '';
  for (const stream of [processHandle.stdout, processHandle.stderr]) {
    stream.on('data', chunk => {
      serverOutput = (serverOutput + chunk.toString()).slice(-4000);
    });
  }

  try {
    const base = `http://127.0.0.1:${port}`;
    await waitForHealth(`${base}/health`, processHandle, () => serverOutput);
    const corsResponse = await fetch(`${base}/health`, {
      headers: { Origin: 'http://localhost:5500' }
    });
    assert.equal(corsResponse.headers.get('access-control-allow-origin'), 'http://localhost:5500');

    for (const route of [
      '/api/identities',
      '/api/contracts',
      '/api/projects',
      '/api/contracts/count',
      '/api/projects/count',
      '/api/identities/count',
      '/api/contracts/groupby/type',
      '/api/projects/groupby/status',
      '/api/identities/groupby/perfil',
      '/uploads/identities/test-image.png',
      '/project-files/test-file.pdf'
    ]) {
      assert.equal((await fetch(base + route)).status, 401, route);
    }
    assert.equal((await fetch(`${base}/update-profile`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'outra-pessoa', cargo: 'Admin' })
    })).status, 401);

    async function postJson(route, body, token) {
      return fetch(base + route, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {})
        },
        body: JSON.stringify(body)
      });
    }

    assert.equal((await postJson('/api/contracts/sync', {})).status, 401);
    assert.equal((await fetch(`${base}/api/contracts/clean-all`, { method: 'DELETE' })).status, 401);

    const suffix = crypto.randomBytes(4).toString('hex');
    const first = `teste-${suffix}-1`;
    const second = `teste-${suffix}-2`;
    const password = 'senha-de-teste-forte';
    for (const [username, cpf] of [[first, '52998224725'], [second, '11144477735']]) {
      const response = await postJson('/register', {
        nome: username,
        cpf,
        email: `${username}@example.test`,
        username,
        password,
        confirmPassword: password
      });
      assert.equal(response.status, 201, await response.text());
    }

    const unknownUser = await postJson('/login', { username: `ausente-${suffix}`, password });
    const wrongPassword = await postJson('/login', { username: first, password: 'senha-incorreta' });
    assert.equal(unknownUser.status, 401);
    assert.equal(wrongPassword.status, 401);
    const unknownBody = await unknownUser.json();
    assert.equal(unknownBody.error, 'invalid_credentials');
    assert.deepEqual(await wrongPassword.json(), unknownBody);

    const login = await postJson('/login', { username: first, password });
    assert.equal(login.status, 200);
    const { token } = await login.json();
    for (const route of [
      '/api/contracts/count',
      '/api/projects/count',
      '/api/identities/count',
      '/api/contracts/groupby/type',
      '/api/projects/groupby/status',
      '/api/identities/groupby/perfil'
    ]) {
      assert.equal((await fetch(base + route, {
        headers: { Authorization: `Bearer ${token}` }
      })).status, 200, route);
    }
    assert.equal((await fetch(`${base}/api/contracts/check?number=nenhum`, {
      headers: { Authorization: `Bearer ${token}` }
    })).status, 200);

    const imageDir = path.join(tempDir, 'uploads', 'identities');
    fs.mkdirSync(imageDir, { recursive: true });
    fs.writeFileSync(path.join(imageDir, 'test-image.png'), Buffer.from([1, 2, 3]));
    const image = await fetch(`${base}/uploads/identities/test-image.png`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    assert.equal(image.status, 200);
    assert.deepEqual(Buffer.from(await image.arrayBuffer()), Buffer.from([1, 2, 3]));

    const contractForm = new FormData();
    contractForm.set('type', 'servico');
    contractForm.set('number', `teste-${suffix}`);
    contractForm.set('date', '2026-01-01');
    contractForm.set('description', 'Contrato de teste');
    contractForm.set('file', new Blob(['%PDF-1.4'], { type: 'application/pdf' }), 'teste.pdf');
    const upload = await fetch(`${base}/api/contracts`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: contractForm
    });
    assert.equal(upload.status, 201, await upload.text());
    const contracts = await fetch(`${base}/api/contracts`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    assert.equal(contracts.status, 200);
    const [contract] = await contracts.json();
    assert.ok(contract?.id);
    const contractFilePath = path.join(tempDir, 'uploads', 'contracts', contract.fileName);
    assert.equal(fs.existsSync(contractFilePath), true);

    const projectForm = new FormData();
    projectForm.set('project', JSON.stringify({
      name: 'Projeto de teste', code: `projeto-${suffix}`, manager: 'Equipe de teste',
      start_date: '2026-01-01', end_date: null, status: 'planejamento', description: 'Projeto temporário'
    }));
    projectForm.append('files', new Blob(['primeiro']), 'primeiro.txt');
    projectForm.append('files', new Blob(['segundo']), 'segundo.txt');
    const projectResponse = await fetch(`${base}/api/projects`, {
      method: 'POST', headers: { Authorization: `Bearer ${token}` }, body: projectForm
    });
    const projectBody = await projectResponse.json();
    assert.equal(projectResponse.status, 200, JSON.stringify(projectBody));
    const { projectId } = projectBody;
    const projectDetails = await fetch(`${base}/api/projects/${projectId}`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    const projectFiles = (await projectDetails.json()).project.files;
    assert.equal(projectFiles.length, 2);
    const projectUploadDir = path.join(tempDir, 'uploads', 'projects');

    const identityForm = new FormData();
    identityForm.set('nome', 'Identidade de teste');
    identityForm.set('cpf', '529.982.247-25');
    identityForm.set('endereco', 'Endereço de teste');
    identityForm.set('perfil', 'Usuário');
    identityForm.set('foto', new Blob(['imagem'], { type: 'image/png' }), 'foto.png');
    const identityResponse = await fetch(`${base}/api/identities`, {
      method: 'POST', headers: { Authorization: `Bearer ${token}` }, body: identityForm
    });
    const identity = await identityResponse.json();
    assert.equal(identityResponse.status, 200, JSON.stringify(identity));
    assert.ok(identity.id);
    const identityPhoto = path.join(tempDir, 'uploads', 'identities', path.basename(identity.foto));
    assert.equal(fs.existsSync(identityPhoto), true);

    const regularUser = await fetch(`${base}/api/user`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    assert.equal((await regularUser.json()).user.isAdmin, false);
    const individualDeletes = [
      `/api/contracts/${contract.id}`,
      `/api/project-files/${projectFiles[0].id}`,
      `/api/projects/${projectId}`,
      `/api/identities/${identity.id}`
    ];
    for (const route of individualDeletes) {
      assert.equal((await fetch(base + route, { method: 'DELETE' })).status, 401, route);
      assert.equal((await fetch(base + route, {
        method: 'DELETE', headers: { Authorization: `Bearer ${token}` }
      })).status, 403, route);
    }
    assert.equal(fs.existsSync(path.join(projectUploadDir, projectFiles[0].filename)), true);
    assert.equal(fs.existsSync(identityPhoto), true);
    assert.equal(fs.existsSync(contractFilePath), true);
    assert.equal((await postJson('/api/contracts/sync', {}, token)).status, 403);
    assert.equal((await fetch(`${base}/api/contracts/clean-all`, {
      method: 'DELETE', headers: { Authorization: `Bearer ${token}` }
    })).status, 403);
    assert.equal((await fetch(`${base}/api/contracts`, {
      headers: { Authorization: `Bearer ${token}` }
    }).then(response => response.json())).length, 1);

    await manageAdmin(`${first}@example.test`);
    const adminUser = await fetch(`${base}/api/user`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    assert.equal((await adminUser.json()).user.isAdmin, true);
    assert.equal((await postJson('/api/contracts/sync', {}, token)).status, 200);

    const deleteContract = await fetch(`${base}/api/contracts/${contract.id}`, {
      method: 'DELETE', headers: { Authorization: `Bearer ${token}` }
    });
    assert.equal(deleteContract.status, 200, await deleteContract.text());
    assert.equal(fs.existsSync(contractFilePath), false);
    assert.equal((await fetch(`${base}/api/contracts`, {
      headers: { Authorization: `Bearer ${token}` }
    }).then(response => response.json())).length, 0);

    const deleteProjectFile = await fetch(`${base}/api/project-files/${projectFiles[0].id}`, {
      method: 'DELETE', headers: { Authorization: `Bearer ${token}` }
    });
    assert.equal(deleteProjectFile.status, 200, await deleteProjectFile.text());
    assert.equal(fs.existsSync(path.join(projectUploadDir, projectFiles[0].filename)), false);
    const deleteProject = await fetch(`${base}/api/projects/${projectId}`, {
      method: 'DELETE', headers: { Authorization: `Bearer ${token}` }
    });
    assert.equal(deleteProject.status, 200, await deleteProject.text());
    assert.equal(fs.existsSync(path.join(projectUploadDir, projectFiles[1].filename)), false);
    assert.equal((await fetch(`${base}/api/projects/${projectId}`, {
      headers: { Authorization: `Bearer ${token}` }
    })).status, 404);

    const deleteIdentity = await fetch(`${base}/api/identities/${identity.id}`, {
      method: 'DELETE', headers: { Authorization: `Bearer ${token}` }
    });
    assert.equal(deleteIdentity.status, 200, await deleteIdentity.text());
    assert.equal(fs.existsSync(identityPhoto), false);

    const finalContractForm = new FormData();
    finalContractForm.set('type', 'servico');
    finalContractForm.set('number', `final-${suffix}`);
    finalContractForm.set('date', '2026-01-01');
    finalContractForm.set('description', 'Contrato para limpeza em massa');
    finalContractForm.set('file', new Blob(['%PDF-1.4'], { type: 'application/pdf' }), 'final.pdf');
    const finalUpload = await fetch(`${base}/api/contracts`, {
      method: 'POST', headers: { Authorization: `Bearer ${token}` }, body: finalContractForm
    });
    assert.equal(finalUpload.status, 201, await finalUpload.text());
    const cleanAll = await fetch(`${base}/api/contracts/clean-all`, {
      method: 'DELETE', headers: { Authorization: `Bearer ${token}` }
    });
    assert.equal(cleanAll.status, 200, await cleanAll.text());
    assert.equal((await fetch(`${base}/api/contracts`, {
      headers: { Authorization: `Bearer ${token}` }
    }).then(response => response.json())).length, 0);
    await manageAdmin(`${first}@example.test`, true);
    assert.equal((await fetch(`${base}/api/contracts/clean-all`, {
      method: 'DELETE', headers: { Authorization: `Bearer ${token}` }
    })).status, 403);
    const revokedUser = await fetch(`${base}/api/user`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    assert.equal((await revokedUser.json()).user.isAdmin, false);
    for (const route of individualDeletes) {
      assert.equal((await fetch(base + route, {
        method: 'DELETE', headers: { Authorization: `Bearer ${token}` }
      })).status, 403, route);
    }

    const update = await fetch(`${base}/update-profile`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify({
        username: second,
        departamento: 'Teste',
        cargo: 'Analista',
        cpf: '52998224725'
      })
    });
    const updateBody = await update.json();
    assert.equal(update.status, 200, JSON.stringify(updateBody));
    assert.equal(updateBody.user.username, first);
    assert.equal(Object.hasOwn(updateBody.user, 'password'), false);

    const otherLogin = await postJson('/login', { username: second, password });
    assert.equal(otherLogin.status, 200);
    assert.equal((await otherLogin.json()).user.cargo, null);

    const newPassword = 'nova-senha-de-teste';
    const changePassword = await postJson('/change-password', {
      username: second,
      currentPassword: password,
      newPassword,
      confirmNewPassword: newPassword
    }, token);
    assert.equal(changePassword.status, 200);
    assert.equal((await postJson('/login', { username: first, password: newPassword })).status, 200);
    assert.equal((await postJson('/login', { username: second, password })).status, 200);

    for (let attempt = 0; attempt < 8; attempt++) {
      assert.equal((await postJson('/login', { username: first, password: 'senha-incorreta' })).status, 401);
    }
    const blockedLogin = await postJson('/login', { username: first, password: newPassword });
    assert.equal(blockedLogin.status, 429);
    assert.ok(Number(blockedLogin.headers.get('retry-after')) > 0);
  } finally {
    if (processHandle.exitCode === null) {
      processHandle.kill();
      await new Promise(resolve => processHandle.once('exit', resolve));
    }
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});
