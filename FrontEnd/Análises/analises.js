
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
    // Contratos por Status
    const contratosStatus = await fetch(`${API_BASE_URL}/contracts/groupby/type`).then(r => r.json()).catch(() => ({}));
    new Chart(document.getElementById('contratosStatusChart'), {
        type: 'doughnut',
        data: {
            labels: Object.keys(contratosStatus),
            datasets: [{
                data: Object.values(contratosStatus),
                backgroundColor: ['#198754', '#ffc107', '#dc3545', '#6c757d']
            }]
        },
        options: { plugins: { legend: { position: 'bottom' }}}
    });

    //Projetos por Status
    const projetosStatus = await fetch(`${API_BASE_URL}/projects/groupby/status`).then(r => r.json()).catch(() => ({}));
    new Chart(document.getElementById('projetosStatusChart'), {
        type: 'bar',
        data: {
            labels: Object.keys(projetosStatus),
            datasets: [{
                label:'Projetos',
                data: Object.values(projetosStatus),
                backgroundColor: '#0d6efd'
            }]
        },
        options: {
            plugins: { legend: 
                {
                display: false 
            }},
            scales: { y: {
                beginAtZero: true
            }}
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
            data: c.updated_at || c.created_at,
            tipo: 'Contrato',
            resumo: c.description || c.numero || c.usuario || '-'
        })),
        ...projetosArr.map(p => ({
            data: p.updated_at || p.created_at,
            tipo: 'Projeto',
            resumo: p.description || p.name,
            status: p.status,
            responsavel: p.manager || '-'
        })),
        ...identidadesArr.map(i => ({
            data: i.updated_at || i.created_at,
            tipo: 'Identidade',
            resumo: i.nome,
            status: i.perfil,
            responsavel: i.nome
        }))
    ].sort((a, b) => new Date(b.data) - new Date(a.data)).slice(0, 10);
    
    const tbody = document.getElementById('analises-recentes');
    tbody.innerHTML = todas.map(a => `
        <tr>
            <td>${a.data ? new Date(a.data).toLocaleDateString('pt-BR') : '-'}</td>
            <td>${a.tipo}</td>
            <td>${a.resumo}</td>
            <td><span class="badge bg-${a.status === 'Concluído' || a.status === 'ativo' ? 'success' : a.status === 'Em andamento' ? 'warning text-dark' : 'secondary'}">${a.status}</span></td>
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

