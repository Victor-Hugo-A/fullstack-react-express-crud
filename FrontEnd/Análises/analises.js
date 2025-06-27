
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

function getStatusSelecionados() {
    return Array.from(document.querySelectorAll('#status-filtros input[type="checkbox"]:checked'))
        .map(cb => cb.value);
}

function getPerfisSelecionados() {
    return Array.from(document.querySelectorAll('#perfil-filtros input[type="checkbox"]:checked'))
        .map(cb => cb.value.toLowerCase());
}

let contratosChart = null;
let projetosChart = null;
let identidadesChart = null;

async function fetchGraficos() {
    // Contratos por Tipo (Pie)
    if (contratosChart) contratosChart.destroy();
    const contratoColors = {
        fornecimento: '#4caf50',
        servicos: '#2196f3',
        aditivo: '#ff9800',
        convenio: '#9c27b0',
        outro: '#607d8b'
    };
    const contratosTipo = await fetch(`${API_BASE_URL}/contracts/groupby/type`).then(r => r.json()).catch(() => []);
    contratosChart = new Chart(document.getElementById('contratosStatusChart'), {
        type: 'pie',
        data: {
            labels: contratosTipo.map(c => (c.tipo ? c.tipo.charAt(0).toUpperCase() + c.tipo.slice(1) : '-')),
            datasets: [{
                data: contratosTipo.map(c => c.count),
                backgroundColor: contratosTipo.map(c => contratoColors[c.tipo?.toLowerCase()] || '#888'),
                borderColor: '#fff',
                borderWidth: 2
            }]
        },
        options: {
            responsive: true,
            plugins: {
                datalabels: {
                    anchor: 'center',
                    align: 'center',
                    offset: 12,
                    padding: { top: 10, bottom: 0 },
                    font: { weight: 'bold', size: 14 },
                    color: '#fff'
                },
                title: {
                    display: true,
                    text: 'Contratos por Tipo',
                    font: { size: 18 },
                    padding: { top: 0, bottom: 23 }
                },
                legend: {
                    display: true,
                    position: 'bottom',
                    labels: {
                        font: { size: 14 },
                        padding: 20
                    }
                },
                tooltip: {
                    callbacks: {
                        label: function(ctx) {
                            const valor = ctx.parsed;
                            const total = ctx.chart.data.datasets[0].data.reduce((a, b) => a + b, 0);
                            const porcentagem = total ? ((valor / total) * 100).toFixed(1) : 0;
                            return `${ctx.label}: ${valor} (${porcentagem}%)`;
                        }
                    }
                }
            },
            animation: { animateRotate: true, animateScale: true }
        },
        plugins: [ChartDataLabels]
    });

    // Projetos por Status (Bar)
    if (projetosChart) projetosChart.destroy();
    const statusColors = {
        andamento: '#0288d1',    // azul
        concluido: '#2e7d32',    // verde
        planejamento: '#ed6c02', // laranja
        suspenso: '#d32f2f'      // vermelho
    };
    const projetosStatus = await fetch(`${API_BASE_URL}/projects/groupby/status`).then(r => r.json()).catch(() => []);
    const labelsProjetos = projetosStatus.map(p => p.status.charAt(0).toUpperCase() + p.status.slice(1));
    const dataProjetos = projetosStatus.map(p => p.count);
    const backgroundColors = projetosStatus.map(p => statusColors[p.status?.toLowerCase()] || '#888');
    projetosChart = new Chart(document.getElementById('projetosStatusChart'), {
        type: 'bar',
        data: {
            labels: labelsProjetos,
            datasets: [{
                label: 'Projetos',
                data: dataProjetos,
                backgroundColor: backgroundColors,
                borderRadius: 8,
                maxBarThickness: 40
            }]
        },
        options: {
            responsive: true,
            plugins: {
                datalabels: {
                    anchor: 'center',
                    align: 'center',
                    offset: 12,
                    padding: { top: 10, bottom: 0 },
                    font: { weight: 'bold', size: 14 },
                    color: '#333'
                },
                title: {
                    display: true,
                    text: 'Projetos por Status',
                    font: { size: 18 },
                    padding: { top: 0, bottom: 26 }
                },
                legend: { display: false },
                tooltip: {
                    callbacks: {
                        label: ctx => `Projetos: ${ctx.raw}`
                    }
                }
            },
            scales: {
                x: { ticks: { font: { size: 14 } } },
                y: { beginAtZero: true, ticks: { stepSize: 1, font: { size: 14 } } }
            },
            animation: { duration: 1000, easing: 'easeOutBounce' }
        },
        plugins: [ChartDataLabels]
    });

    // Identidades por Perfil (Bar) - cada perfil é uma barra
    if (identidadesChart) identidadesChart.destroy();
    const perfilColors = { 
        administrador: '#1565c0', // azul escuro
        usuário: '#1b5e20',       // verde forte
        visitante: '#f57c00'      // laranja forte
    };

    const identidadesPerfil = await fetch(`${API_BASE_URL}/identities/groupby/perfil`).then(r => r.json()).catch(() => []);
    const perfisSelecionados = getPerfisSelecionados();

    // Filtra os perfis selecionados
    const labelsI = perfisSelecionados.map(perfil => perfil.charAt(0).toUpperCase() + perfil.slice(1));
    const dataI = perfisSelecionados.map(perfil => {
        const dadosPerfil = identidadesPerfil.find(i => i.perfil.toLowerCase() === perfil);
        return dadosPerfil ? dadosPerfil.count : 0;
    });
    const backgroundColorsI = perfisSelecionados.map(perfil => perfilColors[perfil] || '#888');

    identidadesChart = new Chart(document.getElementById('identidadesChart'), {
        type: 'bar',
        data: {
            labels: labelsI,
            datasets: [{
                label: 'Identidades',
                data: dataI,
                backgroundColor: backgroundColorsI,
                borderColor: backgroundColorsI,
                borderWidth: 2
            }]
        },
        options: {
            responsive: true,
            plugins: {
                datalabels: {
                    anchor: 'end',
                    align: 'top',
                    font: { weight: 'bold', size: 14 },
                    color: ctx => ctx.dataset.backgroundColor
                },
                title: {
                    display: true,
                    text: 'Identidades por Perfil',
                    font: { size: 18 },
                    padding: { top: 0, bottom: 26 }
                },
                legend: {
                    display: false
                },
                tooltip: {
                    callbacks: {
                        label: ctx => `${ctx.label}: ${ctx.raw}`
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

// Atualiza o gráfico ao mudar os checkboxes
document.getElementById('perfil-filtros').addEventListener('change', fetchGraficos);

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
            <td>${data ? new Date(data).toLocaleDateString('pt-BR', { timeZone: 'UTC'}) : '-'}</td>
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
            <td>${data ? new Date(data).toLocaleDateString('pt-BR', { timeZone: 'UTC'}) : '-'}</td>
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
            <td>${data ? new Date(data).toLocaleDateString('pt-BR', { timeZone: 'UTC'}) : '-'}</td>
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

