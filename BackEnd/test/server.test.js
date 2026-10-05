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
  const bcrypt = require(path.join(backendDir, 'node_modules', 'bcryptjs'));
  for (const file of ['server.js', 'database.js', 'keycloak-config.js', 'config.js']) {
    fs.copyFileSync(path.join(backendDir, file), path.join(tempDir, file));
  }
  for (const directory of ['migrations', 'routes', 'controllers', 'services', 'repositories', 'middlewares']) {
    fs.cpSync(path.join(backendDir, directory), path.join(tempDir, directory), { recursive: true });
  }
  const legacyContractId = crypto.randomUUID();
  fs.mkdirSync(path.join(tempDir, 'data'), { recursive: true });
  fs.mkdirSync(path.join(tempDir, 'uploads', 'contracts'), { recursive: true });
  const legacyContractsJson = JSON.stringify([{
    id: legacyContractId,
    type: 'outro',
    number: 'legado-001',
    date: '2025-05-20',
    description: 'Registro legado importado',
    fileName: 'legado.pdf',
    originalName: 'legado.pdf',
    filePath: '/uploads/contracts/legado.pdf',
    mimeType: 'application/pdf',
    createdAt: '2025-05-20T12:00:00.000Z'
  }]);
  fs.writeFileSync(path.join(tempDir, 'data', 'contracts.json'), legacyContractsJson);
  fs.writeFileSync(path.join(tempDir, 'uploads', 'contracts', 'legado.pdf'), Buffer.from('%PDF-1.4'));
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
  await new Promise((resolve, reject) => oldDatabase.run(
    `INSERT INTO users (id, nome, email, username, password, cpf)
     VALUES (?, ?, ?, ?, ?, ?)`,
    ['legacy-user', 'Conta legada', 'legado@example.test', 'legado', bcrypt.hashSync('senha-legada', 10), '52998224725'],
    error => error ? reject(error) : resolve()
  ));
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

  const nativeFetch = global.fetch;
  global.fetch = async (url, options = {}) => {
    const headers = new Headers(options.headers || {});
    const bearer = headers.get('Authorization')?.match(/^Bearer (.+)$/)?.[1];
    if (bearer) {
      headers.delete('Authorization');
      headers.set('Cookie', `senappen_session=${bearer}; senappen_csrf=integration-csrf-token`);
      if (!['GET', 'HEAD', 'OPTIONS'].includes(String(options.method || 'GET').toUpperCase())) {
        headers.set('X-CSRF-Token', 'integration-csrf-token');
      }
    }
    try {
      return await nativeFetch(url, {
        ...options,
        headers,
        signal: options.signal || AbortSignal.timeout(15000)
      });
    } catch (error) {
      throw new Error(`Requisição de integração sem resposta (${url}): ${error.message}`);
    }
  };

  try {
    const base = `http://127.0.0.1:${port}`;
    await waitForHealth(`${base}/health`, processHandle, () => serverOutput);
    assert.equal(fs.readFileSync(path.join(tempDir, 'data', 'contracts.json'), 'utf8'), legacyContractsJson);
    assert.equal((await postJson('/login', { username: 'legado', password: 'senha-legada' })).status, 200);
    assert.equal((await fetch(`${base}/api/user`, {
      headers: { Cookie: 'senappen_session=invalid.token.value' }
    })).status, 401, 'sessão inválida deve retornar 401, não erro de permissão 403');
    const importedContracts = await fetch(`${base}/api/contracts`);
    assert.equal(importedContracts.status, 401, 'a migração não deve remover a autenticação');
    const corsResponse = await fetch(`${base}/health`, {
      headers: { Origin: 'http://localhost:5500' }
    });
    assert.equal(corsResponse.headers.get('access-control-allow-origin'), 'http://localhost:5500');
    const preflight = await fetch(`${base}/api/contracts`, {
      method: 'OPTIONS',
      headers: {
        Origin: 'http://localhost:5500',
        'Access-Control-Request-Method': 'POST',
        'Access-Control-Request-Headers': 'content-type,x-csrf-token'
      }
    });
    assert.equal(preflight.status, 200);
    assert.match(preflight.headers.get('access-control-allow-headers') || '', /x-csrf-token/i);

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
      '/api/dashboard/summary',
      '/api/analysis/summary',
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
    const rejected = `teste-${suffix}-3`;
    const password = 'senha-de-teste-forte';
    for (const [username, cpf] of [[first, '52998224725'], [second, '11144477735'], [rejected, '93541134780']]) {
      const response = await postJson('/register', {
        nome: username,
        cpf,
        email: `${username}@example.test`,
        username,
        password,
        confirmPassword: password
      });
      const registrationBody = await response.json();
      assert.equal(response.status, 201, JSON.stringify(registrationBody));
      assert.match(registrationBody.message, /aguarde a aprovação/i);
    }

    const pendingLogin = await postJson('/login', { username: first, password });
    assert.equal(pendingLogin.status, 403);
    assert.equal((await pendingLogin.json()).error, 'account_pending');
    const unknownUser = await postJson('/login', { username: `ausente-${suffix}`, password });
    const wrongPassword = await postJson('/login', { username: first, password: 'senha-incorreta' });
    assert.equal(unknownUser.status, 401);
    assert.equal(wrongPassword.status, 401);
    const unknownBody = await unknownUser.json();
    assert.equal(unknownBody.error, 'invalid_credentials');
    assert.deepEqual(await wrongPassword.json(), unknownBody);

    await manageAdmin(`${first}@example.test`);
    const login = await postJson('/login', { username: first, password });
    assert.equal(login.status, 200);
    const sessionCookie = login.headers.getSetCookie().find(cookie => cookie.startsWith('senappen_session='));
    const token = sessionCookie?.match(/^senappen_session=([^;]+)/)?.[1];
    assert.ok(token, 'o login deve emitir o cookie de sessão HttpOnly');
    const importedList = await fetch(`${base}/api/contracts`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    assert.equal(importedList.status, 200);
    const importedRows = await importedList.json();
    assert.equal(importedRows.length, 1);
    assert.equal(importedRows[0].id, legacyContractId);
    assert.equal(importedRows[0].number, 'legado-001');
    const legacyDownload = await fetch(`${base}/api/contracts/${legacyContractId}/download`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    assert.equal(legacyDownload.status, 200);
    assert.equal(Buffer.from(await legacyDownload.arrayBuffer()).toString(), '%PDF-1.4');
    const countForLegacyYear = await fetch(`${base}/api/contracts/count?year=2025`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    assert.equal((await countForLegacyYear.json()).count, 1);
    const contractGroups = await fetch(`${base}/api/contracts/groupby/type`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    assert.deepEqual(await contractGroups.json(), { outro: 1 });
    const contractsUploadDir = path.join(tempDir, 'uploads', 'contracts');
    const beforeRejectedUploads = fs.readdirSync(contractsUploadDir).sort();
    for (const [fileContents, expectedCode] of [
      ['%PDF-1.4', 'invalid_contract_date'],
      ['conteúdo não PDF', 'invalid_file_signature']
    ]) {
      const invalidForm = new FormData();
      invalidForm.set('type', 'servicos');
      invalidForm.set('number', `invalido-${expectedCode}-${suffix}`);
      invalidForm.set('date', expectedCode === 'invalid_contract_date' ? 'data-invalida' : '2026-01-01');
      invalidForm.set('file', new Blob([fileContents], { type: 'application/pdf' }), `${expectedCode}.pdf`);
      const invalidResponse = await fetch(`${base}/api/contracts`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: invalidForm
      });
      assert.equal(invalidResponse.status, 400);
      assert.equal((await invalidResponse.json()).error.code, expectedCode);
      assert.deepEqual(fs.readdirSync(contractsUploadDir).sort(), beforeRejectedUploads);
    }
    const legacyUploadForm = new FormData();
    legacyUploadForm.set('file', new Blob(['conteúdo não PDF'], { type: 'application/pdf' }), 'arquivo-invalido.pdf');
    const legacyUpload = await fetch(`${base}/upload`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: legacyUploadForm
    });
    assert.equal(legacyUpload.status, 400);
    assert.equal((await legacyUpload.json()).error.code, 'invalid_file_signature');
    assert.deepEqual(fs.readdirSync(contractsUploadDir).sort(), beforeRejectedUploads);
    const invalidContractId = await fetch(`${base}/api/contracts/id-invalido`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    assert.equal(invalidContractId.status, 400);
    assert.equal((await fetch(`${base}/api/contracts/count`, {
      headers: { Authorization: `Bearer ${token}` }
    }).then(response => response.json())).count, 1);
    assert.equal((await fetch(`${base}/api/contracts?year=invalido`, {
      headers: { Authorization: `Bearer ${token}` }
    })).status, 400);
    const pendingAccounts = await fetch(`${base}/api/admin/users/pending`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    assert.equal(pendingAccounts.status, 200);
    const pendingUsers = (await pendingAccounts.json()).users;
    const secondPending = pendingUsers.find(user => user.username === second);
    const rejectedPending = pendingUsers.find(user => user.username === rejected);
    assert.ok(secondPending?.id);
    assert.ok(rejectedPending?.id);
    assert.equal((await postJson(`/api/admin/users/${secondPending.id}/approve`, {}, token)).status, 200);
    assert.equal((await postJson(`/api/admin/users/${rejectedPending.id}/reject`, {}, token)).status, 200);
    assert.equal((await postJson(`/api/admin/users/${secondPending.id}/approve`, {}, token)).status, 409);
    const rejectedLogin = await postJson('/login', { username: rejected, password });
    assert.equal(rejectedLogin.status, 403);
    assert.equal((await rejectedLogin.json()).error, 'account_rejected');
    await manageAdmin(`${first}@example.test`, true);
    for (const route of [
      '/api/contracts/count',
      '/api/projects/count',
      '/api/identities/count',
      '/api/contracts/groupby/type',
      '/api/projects/groupby/status',
      '/api/identities/groupby/perfil',
      '/api/dashboard/summary',
      '/api/analysis/summary'
    ]) {
      assert.equal((await fetch(base + route, {
        headers: { Authorization: `Bearer ${token}` }
      })).status, 200, route);
    }
    const dashboardSummary = await fetch(`${base}/api/dashboard/summary`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    assert.equal(dashboardSummary.status, 200);
    assert.deepEqual(Object.keys((await dashboardSummary.json()).totals).sort(), ['all', 'contracts', 'identities', 'projects']);
    const analysisSummary = await fetch(`${base}/api/analysis/summary?from=2026-01-01&to=2026-12-31`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    assert.equal(analysisSummary.status, 200);
    assert.ok(Object.hasOwn(await analysisSummary.json(), 'recent'));
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
    contractForm.set('type', 'servicos');
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
    const listedContracts = await contracts.json();
    assert.equal(listedContracts.length, 2);
    const contract = listedContracts.find(item => item.number === `teste-${suffix}`);
    assert.ok(contract?.id);
    const contractFilePath = path.join(tempDir, 'uploads', 'contracts', contract.fileName);
    assert.equal(fs.existsSync(contractFilePath), true);

    const updateContractForm = new FormData();
    updateContractForm.set('type', 'servicos');
    updateContractForm.set('number', contract.number);
    updateContractForm.set('date', '2026-02-01');
    updateContractForm.set('description', 'Contrato atualizado sem substituir o arquivo');
    const updateContract = await fetch(`${base}/api/contracts/${contract.id}`, {
      method: 'PUT', headers: { Authorization: `Bearer ${token}` }, body: updateContractForm
    });
    assert.equal(updateContract.status, 200, await updateContract.text());
    const updatedContract = await fetch(`${base}/api/contracts/${contract.id}`, {
      headers: { Authorization: `Bearer ${token}` }
    }).then(response => response.json());
    assert.equal(updatedContract.description, 'Contrato atualizado sem substituir o arquivo');
    assert.equal(fs.existsSync(contractFilePath), true);

    const projectForm = new FormData();
    projectForm.set('project', JSON.stringify({
      name: 'Projeto de teste', code: `projeto-${suffix}`, manager: 'Equipe de teste',
      start_date: '2026-01-01', end_date: null, status: 'planejamento', description: 'Projeto temporário'
    }));
    projectForm.append('files', new Blob(['%PDF-1.4'], { type: 'application/pdf' }), 'primeiro.pdf');
    projectForm.append('files', new Blob(['%PDF-1.4'], { type: 'application/pdf' }), 'segundo.pdf');
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
    const projectList = await fetch(`${base}/api/projects?page=1&limit=10&status=planejamento`, {
      headers: { Authorization: `Bearer ${token}` }
    }).then(response => response.json());
    assert.equal(projectList.success, true);
    assert.equal(projectList.projects.length, 1);
    assert.equal(projectList.projects[0].files.length, 2);
    assert.equal(projectList.page, 1);
    assert.equal(projectList.limit, 10);
    assert.deepEqual(await fetch(`${base}/api/projects/count?year=2026`, {
      headers: { Authorization: `Bearer ${token}` }
    }).then(response => response.json()), { count: 1 });
    assert.deepEqual(await fetch(`${base}/api/projects/groupby/status`, {
      headers: { Authorization: `Bearer ${token}` }
    }).then(response => response.json()), [{ status: 'planejamento', count: 1 }]);
    const projectFileResponse = await fetch(`${base}/api/project-files/${projectFiles[0].filename}`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    assert.equal(projectFileResponse.status, 200);
    assert.equal((await projectFileResponse.text()).slice(0, 8), '%PDF-1.4');
    const downloadedProjectFile = await fetch(`${base}/api/project-files/${projectFiles[0].filename}?download=1`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    assert.equal(downloadedProjectFile.status, 200);
    assert.match(downloadedProjectFile.headers.get('content-disposition') || '', /attachment/);

    const projectUpdateForm = new FormData();
    projectUpdateForm.set('project', JSON.stringify({
      name: 'Projeto atualizado', code: `projeto-${suffix}`, manager: 'Equipe de teste',
      start_date: '2026-01-01', end_date: null, status: 'andamento', description: 'Projeto atualizado'
    }));
    const projectUpdate = await fetch(`${base}/api/projects/${projectId}`, {
      method: 'PUT', headers: { Authorization: `Bearer ${token}` }, body: projectUpdateForm
    });
    const updatedProject = await projectUpdate.json();
    assert.equal(projectUpdate.status, 200, JSON.stringify(updatedProject));
    assert.equal(updatedProject.project.name, 'Projeto atualizado');
    assert.equal(updatedProject.project.files.length, 2);

    const identityForm = new FormData();
    const identityUploadsDir = path.join(tempDir, 'uploads', 'identities');
    fs.mkdirSync(identityUploadsDir, { recursive: true });
    const identityFilesBeforeRejections = fs.readdirSync(identityUploadsDir).sort();
    const identityHeaders = { Authorization: `Bearer ${token}` };
    for (const [photo, mimeType, fileName] of [
      [new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), 'image/jpeg', 'tipo-incorreto.png'],
      [new Uint8Array([1, 2, 3]), 'image/png', 'assinatura-incorreta.png']
    ]) {
      const invalidPhotoForm = new FormData();
      invalidPhotoForm.set('foto', new Blob([photo], { type: mimeType }), fileName);
      const rejectedPhoto = await fetch(`${base}/api/identities`, {
        method: 'POST',
        headers: identityHeaders,
        body: invalidPhotoForm
      });
      assert.equal(rejectedPhoto.status, 400);
      assert.equal((await rejectedPhoto.json()).error.code, 'invalid_file_signature');
    }
    assert.deepEqual(fs.readdirSync(identityUploadsDir).sort(), identityFilesBeforeRejections);

    identityForm.set('nome', 'Identidade de teste');
    identityForm.set('cpf', '529.982.247-25');
    identityForm.set('endereco', 'Endereço de teste');
    identityForm.set('perfil', 'Usuário');
    identityForm.set('foto', new Blob([new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])], { type: 'image/png' }), 'foto.png');
    const identityResponse = await fetch(`${base}/api/identities`, {
      method: 'POST', headers: { Authorization: `Bearer ${token}` }, body: identityForm
    });
    const identity = await identityResponse.json();
    assert.equal(identityResponse.status, 200, JSON.stringify(identity));
    assert.ok(identity.id);
    const identityPhoto = path.join(tempDir, 'uploads', 'identities', path.basename(identity.foto));
    assert.equal(fs.existsSync(identityPhoto), true);
    const listedIdentities = await fetch(`${base}/api/identities`, {
      headers: identityHeaders
    });
    assert.equal(listedIdentities.status, 200);
    assert.equal((await listedIdentities.json()).find(item => item.id === identity.id).foto, identity.foto);
    assert.deepEqual(await fetch(`${base}/api/identities/count`, {
      headers: identityHeaders
    }).then(response => response.json()), { count: 1 });
    assert.deepEqual(await fetch(`${base}/api/identities/groupby/perfil`, {
      headers: identityHeaders
    }).then(response => response.json()), [{ perfil: 'Usuário', count: 1 }]);

    const regularUser = await fetch(`${base}/api/user`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    const regularUserBody = await regularUser.json();
    assert.equal(regularUserBody.user.isAdmin, false);
    assert.equal(regularUserBody.user.cpf, '52998224725');
    assert.equal(regularUserBody.user.departamento, null);
    assert.equal(regularUserBody.user.cargo, null);
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
    }).then(response => response.json())).length, 2);

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
    }).then(response => response.json())).length, 1);

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
    finalContractForm.set('type', 'servicos');
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
    const regularToken = otherLogin.headers.getSetCookie().find(cookie => cookie.startsWith('senappen_session='))?.match(/^senappen_session=([^;]+)/)?.[1];
    assert.ok(regularToken);
    assert.equal((await fetch(`${base}/api/admin/users/pending`, {
      headers: { Authorization: `Bearer ${regularToken}` }
    })).status, 403);
    assert.equal((await postJson(`/api/admin/users/${rejectedPending.id}/approve`, {}, regularToken)).status, 403);
    assert.equal((await fetch(`${base}/api/admin/audit`, {
      headers: { Authorization: `Bearer ${regularToken}` }
    })).status, 403);

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

    await manageAdmin(`${first}@example.test`);
    const auditResponse = await fetch(`${base}/api/admin/audit?limit=500`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    assert.equal(auditResponse.status, 200);
    const auditEvents = (await auditResponse.json()).events;
    for (const action of ['login', 'approve_account', 'reject_account', 'upload', 'update', 'delete']) {
      assert.ok(auditEvents.some(event => event.action === action), `evento de auditoria ausente: ${action}`);
    }
    assert.ok(auditEvents.some(event => event.action === 'login' && event.outcome === 'failed'));
    assert.ok(auditEvents.some(event => event.action === 'login' && event.outcome === 'rate_limited'));
    assert.ok(auditEvents.some(event => event.userId === JSON.parse(Buffer.from(token.split('.')[1], 'base64url').toString()).userId));
    assert.ok(auditEvents.every(event => event.occurredAt && event.entity && event.ipAddress));
    await manageAdmin(`${first}@example.test`, true);
  } finally {
    global.fetch = nativeFetch;
    if (processHandle.exitCode === null) {
      processHandle.kill();
      await new Promise(resolve => processHandle.once('exit', resolve));
    }
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});
