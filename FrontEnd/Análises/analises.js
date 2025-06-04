
document.addEventListener('DOMContentLoaded', () => {
const API_BASE_URL = 'http://localhost:3000/api';

async function fetchResumo() {
    // Busca contadores
    const[contratos, projetos, identidades] = await Promise.all([
        fetch(`${API_BASE_URL}/contracts/count`).then(r => r.json()).catch(() => ({ count: 0 })),
        fetch(`${API_BASE_URL}/projects/count`).then(r => r.json()).catch(() => ({ count: 0 })),
        fetch(`${API_BASE_URL}/identities/count`).then(r => r.json()).catch(() => ({ count: 0 })),
    ]);  
    document.getElementById('contratos-ativos').textContent = contratos.count || 0;  
    document.getElementById('projetos-andamento').textContent = projetos.count || 0;  
    document.getElementById('identidades-cadastradas').textContent = identidades.count || 0;  
}

async function fetchGraficos() {
    // Contratos por Tipo
    const contratosTipo = await fetch(`${API_BASE_URL}/contracts/groupby/type`).then(r => r.json()).catch(() => ({}));
    new Chart(document.getElementById('contratosStatusChart'), {
        type: 'doughnut',
        data: {
            labels: contratosTipo.map(c => (c.tipo ? c.tipo.charAt(0).toUpperCase() + c.tipo.slice(1) : '-')),
            datasets: [{
                data: contratosTipo.map(c => c.count),
                backgroundColor: ['#ff9800', '#9c27b0', '#4caf50', '#6c757d', '#2196f3']
            }]
        },
        options: { plugins: { legend: { position: 'bottom' }}}
    });

    //Projetos por Status
    const projetosStatus = await fetch(`${API_BASE_URL}/projects/groupby/status`).then(r => r.json()).catch(() => ({}));
    new Chart(document.getElementById('projetosStatusChart'), {
        type: 'bar',
        data: {
            labels: projetosStatus.map(p => p.status.charAt(0).toUpperCase() + p.status.slice(1)),
            datasets: [{
                label:'Projetos',
                data: projetosStatus.map(p => p.count),
                backgroundColor: ['#2e7d32', '#ed6c02', '#d32f2f']
            }]
        },
        options: {
            plugins: { legend: { display: false }},
            scales: { y: { beginAtZero: true }}
        }
    });
        const identidadesPerfil = await fetch (`${API_BASE_URL}/identities/groupby/perfil`).then(r => r.json()).catch(() => ({}));
        new Chart(document.getElementById('identidadesChart'), {
            type: 'line',
            data: {
                labels: identidadesPerfil.map(i => i.perfil.charAt(0).toUpperCase() + i.perfil.slice(1)),
                datasets: [{
                    label: 'Quantidade',
                    data: identidadesPerfil.map(i => i.count),
                    backgroundColor: ['#1565c0', '#1b5e20', '#f57c00']
                }]
            },
            options: {
                plugins: { title: { display: true, text: 'Identidades por Perfil' } },
                responsive: true
            }
        });
    }


async function fetchAnalisesRecentes() {
    // Busca últimas análises ( contratos, projetos, identidades )
    const[contratos, projetos, identidades] = await Promise.all([
        fetch(`${API_BASE_URL}/contracts`).then(r => r.json()).catch(() => []),
        fetch(`${API_BASE_URL}/projects`).then(r => r.json()).catch(() => []),
        fetch(`${API_BASE_URL}/identities`).then(r => r.json()).catch(() => []),
    ]);

    const contratosArr = Array.isArray(contratos) ? contratos : [];
    const projetosArr = Array.isArray(projetos) ? projetos : [];
    const identidadesArr = Array.isArray(identidades) ? identidades : [];

    //Junta e ordena por data
    const todas = [
        ...contratosArr.map(c => ({
            data: c.updated_at || c.created_at || c.dataCriacao || c.data || c.date || null,
            tipo: 'Contrato',
            resumo: c.description || c.numero || c.usuario || '-',
            status: c.status || c.type || '-',
            responsavel: 'Não existe Reponsável, para o tipo de contrato!'
        })),
        ...projetosArr.map(p => ({
            data: p.updated_at || p.created_at || p.data || null,
            tipo: 'Projeto',
            resumo: p.description || p.name,
            status: p.status,
            responsavel: p.manager || '-'
        })),
        ...identidadesArr.map(i => ({
            data: i.updated_at || i.created_at || i.data || null,
            tipo: 'Identidade',
            resumo: i.cpf || '-',
            status: i.perfil || '-',
            responsavel: i.nome || '-'
        }))
    ].sort((a, b) => new Date(b.data) - new Date(a.data)).slice(0, 10);
    
    const tbody = document.getElementById('analises-recentes');
    tbody.innerHTML = todas.map(a => `
        <tr>
            <td>${a.data ? new Date(a.data).toLocaleDateString('pt-BR') : '-'}</td>
            <td>${a.tipo}</td>
            <td>${a.resumo}</td>
            <td><span class="badge -${a.status === 'Concluído' || a.status === 'ativo' ? 'success' : a.status === 'Em andamento' ? 'warning text-dark' : 'secondary'}">${a.status}</span></td>
            <td>${a.responsavel}</td>
        </tr>
    `).join('');
}

// FUNÇÃO PARA MOSTRAR NOME DE USUÁRIO
async function displayUsername() {
    const usernameElement = document.getElementById('username-display');
    const token = localStorage.getItem('token');
    if (!token) {
        usernameElement.textContent = 'Visitante';
        return;
    }
    try {
        const response = await fetch(`${API_BASE_URL}/user`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (!response.ok) throw new Error();
        const data = await response.json();
        usernameElement.textContent = data.user?.nome || data.user?.username || 'Usuário';
    } catch {
        usernameElement.textContent = 'Usuário';
    }
}

    fetchResumo();
    fetchGraficos();
    fetchAnalisesRecentes();
    displayUsername();

    // Menu expansível para Documentos
    const documentosToggle = document.getElementById('documentosToggle');
    const submenuDocumentos = document.getElementById('submenuDocumentos');
    if (documentosToggle && submenuDocumentos) {
        documentosToggle.addEventListener('click', function(e) {
            e.preventDefault();
            submenuDocumentos.style.display = submenuDocumentos.style.display === 'none' ? 'block' : 'none';
            documentosToggle.querySelector('.submenu-arrow').classList.toggle('rotated');
        });
    }

    // Sidebar toggle
    const menuToggle = document.getElementById("menuToggle");
    const sidebar = document.getElementById("sidebar");
    if (menuToggle && sidebar) {
        menuToggle.addEventListener("click", () => {
            sidebar.classList.toggle("closed");
            menuToggle.textContent = sidebar.classList.contains("closed") ? "☰" : "✕";
        });
    }
});

