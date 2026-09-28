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

test('autenticação e atualização de perfil em banco isolado', async () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'crud-smoke-'));
  const port = await freePort();
  const backendDir = path.resolve(__dirname, '..');
  for (const file of ['server.js', 'database.js', 'keycloak-config.js']) {
    fs.copyFileSync(path.join(backendDir, file), path.join(tempDir, file));
  }
  fs.writeFileSync(path.join(tempDir, '.env'), [
    `PORT=${port}`,
    `SECRET_KEY=${crypto.randomBytes(32).toString('hex')}`,
    `SESSION_SECRET=${crypto.randomBytes(32).toString('hex')}`
  ].join('\n'));

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

    const login = await postJson('/login', { username: first, password });
    assert.equal(login.status, 200);
    const { token } = await login.json();
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
    assert.equal((await contracts.json()).length, 1);

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
  } finally {
    if (processHandle.exitCode === null) {
      processHandle.kill();
      await new Promise(resolve => processHandle.once('exit', resolve));
    }
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});
