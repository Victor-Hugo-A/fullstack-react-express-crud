const { test, expect } = require('@playwright/test');

const user = { nome: 'Gestor de Testes', username: 'gestor', cpf: '52998224725', role: 'admin', isAdmin: true };

const contracts = Array.from({ length: 7 }, (_, index) => ({
    id: `00000000-0000-4000-8000-${String(index + 1).padStart(12, '0')}`,
    type: 'servicos',
    number: `CT-${String(7 - index).padStart(2, '0')}`,
    date: `2026-01-${String(index + 1).padStart(2, '0')}`,
    description: `Contrato de teste ${index + 1}`,
    originalName: 'contrato.pdf',
    mimeType: 'application/pdf'
}));

const projects = Array.from({ length: 7 }, (_, index) => ({
    id: `project-${index + 1}`,
    code: `PRJ-${index + 1}`,
    name: `Projeto ${index + 1}`,
    manager: 'Gestor de Testes',
    start_date: `2026-02-${String(index + 1).padStart(2, '0')}`,
    end_date: '2026-12-31',
    status: 'andamento',
    description: 'Projeto utilizado apenas na automação.',
    files: []
}));

const identities = [
    { id: 1, nome: 'Zélia Andrade', cpf: '11111111111', endereco: 'Rua A', perfil: 'Usuário', created_at: '2026-01-01T10:00:00.000Z' },
    { id: 2, nome: 'Ana Beatriz', cpf: '22222222222', endereco: 'Rua B', perfil: 'Administrador', created_at: '2026-03-01T10:00:00.000Z' },
    { id: 3, nome: 'Carlos Mendes', cpf: '33333333333', endereco: 'Rua C', perfil: 'Visitante', created_at: '2026-02-01T10:00:00.000Z' }
];

async function mockApi(page) {
    await page.route('http://localhost:3000/**', async route => {
        const request = route.request();
        const url = new URL(request.url());
        const headers = {
            'Access-Control-Allow-Origin': 'http://127.0.0.1:5501',
            'Access-Control-Allow-Credentials': 'true',
            'Content-Type': 'application/json'
        };

        if (request.method() === 'OPTIONS') {
            await route.fulfill({ status: 200, headers });
            return;
        }
        if (url.pathname === '/login' && request.method() === 'POST') {
            await route.fulfill({ status: 200, headers, body: JSON.stringify({ success: true, user }) });
            return;
        }
        if (url.pathname === '/api/user') {
            await route.fulfill({ status: 200, headers, body: JSON.stringify({ success: true, user }) });
            return;
        }
        if (url.pathname === '/api/analysis/summary') {
            await route.fulfill({ status: 200, headers, body: JSON.stringify({ totals: { contracts: 7, projects: 7, identities: 3, completedProjects: 2, overdueProjects: 1 }, groups: { contracts: [{ tipo: 'servicos', count: 7 }], projects: [{ status: 'andamento', count: 7 }], identities: [{ perfil: 'Usuário', count: 3 }] }, recent: { contracts: contracts.slice(0, 1), projects: projects.slice(0, 1), identities: identities.slice(0, 1) }, projectHistory: { available: true, events: [{ action: 'update', projectId: 'project-1', projectName: 'Projeto 1', actorName: 'Gestor de Testes', occurredAt: '2026-03-15T14:30:00.000Z' }] }, updatedAt: '2026-03-15T14:30:00.000Z' }) });
            return;
        }
        if (url.pathname === '/api/admin/users' && request.method() === 'POST') {
            await route.fulfill({
                status: 201,
                headers,
                body: JSON.stringify({ success: true, message: 'Conta criada e liberada para acesso.', user: { id: 'new-user' } })
            });
            return;
        }
        if (url.pathname === '/api/admin/users' && request.method() === 'GET') {
            await route.fulfill({ status: 200, headers, body: JSON.stringify({ success: true, users: [{ id: 'new-user', nome: 'Nova Pessoa', username: 'nova.pessoa', email: 'nova.pessoa@example.test', cpf: '52998224725', departamento: 'Gestão', cargo: 'Analista', role: 'viewer' }] }) });
            return;
        }
        if (url.pathname === '/api/admin/users/new-user' && request.method() === 'PUT') {
            await route.fulfill({ status: 200, headers, body: JSON.stringify({ success: true, message: 'Dados e permissões atualizados.' }) });
            return;
        }
        if (url.pathname === '/api/contracts') {
            await route.fulfill({ status: 200, headers, body: JSON.stringify(contracts) });
            return;
        }
        if (url.pathname === '/api/projects') {
            await route.fulfill({ status: 200, headers, body: JSON.stringify({ success: true, projects }) });
            return;
        }
        if (url.pathname === '/api/identities') {
            await route.fulfill({ status: 200, headers, body: JSON.stringify(identities) });
            return;
        }
        await route.fulfill({ status: 200, headers, body: JSON.stringify({ success: true }) });
    });
}

async function authenticatedPage(page, path) {
    await page.addInitScript(() => {
        sessionStorage.setItem('portal-session', 'active');
        sessionStorage.setItem('userData', JSON.stringify({ nome: 'Gestor de Testes', isAdmin: true }));
    });
    await page.goto(path);
}

test.beforeEach(async ({ page }) => {
    await mockApi(page);
});

test('login autentica e encaminha para o portal', async ({ page }) => {
    await page.goto('/login.html');
    await page.locator('#username').fill('gestor');
    await page.locator('#password').fill('senha-segura');
    await page.locator('#loginForm button[type="submit"]').click();

    await expect(page).toHaveURL(/\/Sistema\/sistema\.html$/);
    await expect(page.getByText('Gestor de Testes').first()).toBeVisible();
    await expect(page.locator('#admin-users-link')).toBeVisible();
    await expect(page.locator('#admin-users-link')).toHaveAttribute('href', '/Admin/usuarios.html');
});

test('administrador cria e altera permissões de uma conta', async ({ page }) => {
    await authenticatedPage(page, '/Admin/usuarios.html');
    await expect(page.locator('#create-user-form')).toBeVisible();

    await page.locator('#create-user-form [name="nome"]').fill('Nova Pessoa');
    await page.locator('#create-user-form [name="cpf"]').fill('52998224725');
    await page.locator('#create-user-form [name="email"]').fill('nova.pessoa@example.test');
    await page.locator('#create-user-form [name="username"]').fill('nova.pessoa');
    await page.locator('#create-user-form [name="password"]').fill('senha-inicial');
    await page.locator('#create-user-form [name="confirmPassword"]').fill('senha-inicial');
    await page.locator('#create-user-form button[type="submit"]').click();

    await expect(page.locator('#users-status')).toContainText('Conta criada e liberada para acesso.');
    await page.locator('#users-list .edit-user').click();
    await page.locator('#edit-user-form [name="role"]').selectOption('editor');
    await page.locator('#edit-user-form button[type="submit"]').click();

    await expect(page.locator('#users-status')).toContainText('Dados e permissões atualizados.');
});

test('perfil bloqueia CPF inválido antes de salvar', async ({ page }) => {
    await authenticatedPage(page, '/Perfil/perfil.html');
    const cpf = page.locator('#cpf');
    await expect(cpf).toBeEnabled();
    await cpf.fill('33333333333');
    await page.locator('#perfil-form button[type="submit"]').click();

    await expect(page.locator('#profile-save-status')).toHaveText('CPF inválido');
    await expect(page.locator('#mensagem-login')).toContainText('Informe um CPF válido');
});

test('contratos pagina seis resultados e permite ordenar', async ({ page }) => {
    await authenticatedPage(page, '/Documentos/contrato.html');
    await expect(page.locator('#documents-container .document-card')).toHaveCount(6);
    await expect(page.locator('#contracts-summary')).toContainText('7 contratos encontrados');

    await page.locator('.pagination button[aria-label="Próxima página"]').click();
    await expect(page.locator('#documents-container .document-card')).toHaveCount(1);
    await expect(page.locator('#documents-container')).toContainText('CT-07');

    await page.locator('#contract-sort').selectOption('number-asc');
    await expect(page.locator('#documents-container')).toContainText('CT-01');
});

test('projetos pagina seis resultados', async ({ page }) => {
    await authenticatedPage(page, '/Documentos/projetos.html');
    await expect(page.locator('#projects-table tbody tr')).toHaveCount(6);
    await expect(page.locator('#projects-summary')).toContainText('7 projetos encontrados');

    await page.locator('.pagination button[aria-label="Próxima página"]').click();
    await expect(page.locator('#projects-table tbody tr')).toHaveCount(1);
    await expect(page.locator('#projects-table')).toContainText('Projeto 1');
});

test('identidades ordena os registros pelo nome', async ({ page }) => {
    await authenticatedPage(page, '/Documentos/identidades.html');
    await expect(page.locator('#identities-table tbody tr')).toHaveCount(3);

    await page.locator('#identity-sort').selectOption('name-asc');
    await expect(page.locator('#identities-table tbody tr').first()).toContainText('Ana Beatriz');
    await expect(page.locator('#identities-summary')).toContainText('3 identidades encontradas');
});

test('análises abre pelo endereço público sem acento', async ({ page }) => {
    await authenticatedPage(page, '/Analises/analises.html');
    await expect(page.getByRole('heading', { name: 'Análises dos registros' })).toBeVisible();
    await expect(page.locator('#project-history-section')).toBeVisible();
    await expect(page.locator('#project-history-list')).toContainText('Projeto 1');
});

test('normativos e manuais exibem orientações de uso', async ({ page }) => {
    await authenticatedPage(page, '/Normativos/normativos.html');
    await expect(page.getByRole('heading', { name: 'Normativos e boas práticas' })).toBeVisible();
    await expect(page.getByText('Controle de acesso')).toBeVisible();

    await authenticatedPage(page, '/Manuais/manuais.html');
    await expect(page.getByRole('heading', { name: 'Manuais de uso do portal' })).toBeVisible();
    await expect(page.getByText('Guias por área')).toBeVisible();
});

test('endereço antigo de análises com acento é redirecionado', async ({ page }) => {
    await authenticatedPage(page, '/An%E1lises/analises.html');
    await expect(page).toHaveURL(/\/Analises\/analises\.html$/);
    await expect(page.getByRole('heading', { name: 'Análises dos registros' })).toBeVisible();
});
