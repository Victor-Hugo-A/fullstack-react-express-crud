
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
    // Contratos por Tipo (Pie)
    const contratosTipo = await fetch(`${API_BASE_URL}/contracts/groupby/type`).then(r => r.json()).catch(() => []);
    new Chart(document.getElementById('contratosStatusChart'), {
        type: 'pie',
        data: {
            labels: contratosTipo.map(c => (c.tipo ? c.tipo.charAt(0).toUpperCase() + c.tipo.slice(1) : '-')),
            datasets: [{
                data: contratosTipo.map(c => c.count),
                backgroundColor: [
                    '#1976d2', '#43a047', '#fbc02d', '#e53935', '#8e24aa'
                ],
                borderColor: '#fff',
                borderWidth: 2
            }]
        },
        options: {
            responsive: true,
            plugins: {
                    datalabels: {
                    achor: 'end',
                    align: 'top',
                    offset: 12,
                    padding: {
                        top: 10,
                        bottom: 0
                    },
                    font: { weight: 'bold', size: 18 },
                    color: '#333'
                },
                title: {
                    display: true,
                    text: 'Contratos por Tipo',
                    font: { size: 18 }
                },
                legend: {
                    position: 'bottom',
                    labels: { font: { size: 14 } }
                },
                tooltip: {
                    callbacks: {
                        label: ctx => `${ctx.label}: ${ctx.parsed} contratos`
                    }
                }
            },
            animation: { animateRotate: true, animateScale: true }
        },
        plugins: [ChartDataLabels]
    });

    // Projetos por Status (Bar)
    const projetosStatus = await fetch(`${API_BASE_URL}/projects/groupby/status`).then(r => r.json()).catch(() => []);
    new Chart(document.getElementById('projetosStatusChart'), {
        type: 'bar',
        data: {
            labels: projetosStatus.map(p => p.status.charAt(0).toUpperCase() + p.status.slice(1)),
            datasets: [{
                label: 'Projetos',
                data: projetosStatus.map(p => p.count),
                backgroundColor: [
                    '#0288d1', '#43a047', '#fbc02d', '#e53935'
                ],
                borderRadius: 8,
                maxBarThickness: 40
            }]
        },
        options: {
            responsive: true,
            plugins: {
                datalabels: {
                    achor: 'end',
                    align: 'top',
                    offset: 12,
                    padding: {
                        top: 10,
                        bottom: 0
                    },
                    font: { weight: 'bold', size: 11 },
                    color: '#333'
                },
                title: {
                    display: true,
                    text: 'Projetos por Status',
                    font: { size: 18 }
                },
                legend: { display: false },
                tooltip: {
                    callbacks: {
                        label: ctx => `Projetos: ${ctx.parsed.y}`
                    }
                }
            },
            scales: {
                x: {
                    ticks: { font: { size: 14 } }
                },
                y: {
                    beginAtZero: true,
                    ticks: { stepSize: 1, font: { size: 14 } }
                }
            },
            animation: { duration: 1000, easing: 'easeOutBounce' }
        },
        plugins: [ChartDataLabels]
    });

    // Identidades por Perfil (Line)
    const identidadesPerfil = await fetch(`${API_BASE_URL}/identities/groupby/perfil`).then(r => r.json()).catch(() => []);
    new Chart(document.getElementById('identidadesChart'), {
        type: 'line',
        data: {
            labels: identidadesPerfil.map(i => i.perfil.charAt(0).toUpperCase() + i.perfil.slice(1)),
            datasets: [{
                label: 'Quantidade',
                data: identidadesPerfil.map(i => i.count),
                fill: true,
                borderColor: '#1976d2',
                backgroundColor: 'rgba(25, 118, 210, 0.15)',
                pointBackgroundColor: '#1976d2',
                tension: 0.4
            }]
        },
        options: {
            responsive: true,
            plugins: {
                    datalabels: {
                    achor: 'end',
                    align: 'top',
                    font: { weight: 'bold', size: 11 },
                    color: '#333'
                },
                title: {
                    display: true,
                    text: 'Identidades por Perfil',
                    font: { size: 18 }
                },
                legend: {
                    display: true,
                    labels: { font: { size: 14 } }
                },
                tooltip: {
                    callbacks: {
                        label: ctx => `Quantidade: ${ctx.parsed.y}`,
                    }
                }
            },
            scales: {
                x: { ticks: { font: { size: 14 } } },
                y: { beginAtZero: true, ticks: { stepSize: 1, font: { size: 14 } } }
            },
            animation: { duration: 1200, easing: 'easeInOutQuart' }
        },
        plugins: [ChartDataLabels]
    });
}


async function fetchAnalisesRecentes() {
    // Busca últimas análises ( contratos, projetos, identidades )
    const[contratos, projetos, identidades] = await Promise.all([
        fetch(`${API_BASE_URL}/contracts`).then(r => r.json()).catch(() => []),
        fetch(`${API_BASE_URL}/projects`).then(r => r.json()).catch(() => []),
        fetch(`${API_BASE_URL}/identities`).then(r => r.json()).catch(() => []),
    ]);


    // CONTRATOS
    const contratosArr = Array.isArray(contratos) ? contratos : [];
    document.getElementById('contratos-recentes').innerHTML = contratosArr
    .sort((a, b) => new Date(b.updated_at || b.created_at || b.date) - new Date(a.updated_at || a.created_at || a.date))
    .slice(0, 10)
    .map(c => {
        const data =c.updated_at || c.created_at || c.data || c.date || null;
    return `
        <tr>
            <td>${data ? new Date(data).toLocaleDateString('pt-BR'):'-'}</td>
            <td>${c.number || '-'}</td>
            <td><span class="badge ${c.type === 'aditivo'? 'aditivo' : c.type === 'convenio'? 'convenio' : c.type === 'fornecimento'? 'fornecimento' : c.type}">
            ${c.type || '-'}</span></td>
            <td>${c.description || '-'}</td>
        </tr>
    `}).join('');

    // PROJETOS
    const projetosArr = Array.isArray(projetos.projects) ? projetos.projects : [];
    document.getElementById('projetos-recentes').innerHTML = projetosArr
    .sort((a, b) => new Date(b.updated_at || b.created_at) - new Date(a.updated_at || a.created_at))
    .slice(0, 10)
    .map(p =>  {
        const data = p.updated_at || p.created_at || p.data || p.date || null;
    return `
        <tr>
            <td>${data ? new Date(data).toLocaleDateString('pt-BR'):'-'}</td>
            <td>${p.name || '-'}</td>
            <td>${p.code || '-'}</td>
            <td><span class="badge ${p.status === 'planejamento'?'plan': p.status === 'andamento'?'and': p.status === 'suspenso'?'susp' : p.status === 'concluido'?'conc': 
            ''}">${p.status || '-'}</span></td>
            <td>${p.manager || '-'}</td>
        </tr>
    `}).join('');

    // IDENTIDADES
    const identidadesArr = Array.isArray(identidades) ? identidades : [];
    document.getElementById('identidades-recentes').innerHTML = identidadesArr
    .sort((a, b) => new Date(b.updated_at || b.created_at || b.data) - new Date(a.updated_at || a.created_at || a.data))
    .slice(0, 10)
    .map(i =>  {
        const data = i.updated_at || i.created_at || i.data || i.date || null;
    return `
        <tr>
            <td>${data ? new Date(data).toLocaleDateString('pt-BR'):'-'}</td>
            <td>${i.cpf || '-'}</td>
            <td>${i.nome || '-'}</td> 
            <td><span class="badge ${i.perfil === 'Administrador'?'admin' : i.perfil === 'Usuário'?'user' : i.perfil === 'Visitante'?'vis' : ''}">${i.perfil || '-'}</span></td>
        </tr>
    `}).join('');
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

