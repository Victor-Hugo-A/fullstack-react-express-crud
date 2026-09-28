// Funções para buscar dados agrupados do backend
async function fetchContratosPorTipo() {
    return apiGet('/api/contracts/groupby/type');
}

async function fetchProjetosPorStatus() {
    return apiGet('/api/projects/groupby/status');
}

async function fetchIdentidadesPorPerfil() {
    return apiGet('/api/identities/groupby/perfil');
}

// Renderização dos gráficos
async function renderCharts() {
    // Projetos por status
    const statusColors = {
        'concluido': '#2e7d32',
        'andamento': '#0288d1',
        'planejamento': '#ed6c02',
        'suspenso': '#d32f2f'
    };
    const projetos = await fetchProjetosPorStatus();
    const projetosLabels = projetos.map(p => p.status.charAt(0).toUpperCase() + p.status.slice(1));
    const projetosData = projetos.map(p => p.count);
    const projetosColors = projetos.map(p => statusColors[p.status.toLowerCase()] || '#888');

    new Chart(document.getElementById('projetosChart'), {
        type: 'pie',
        data: {
            labels: projetosLabels,
            datasets: [{
                label: 'Quantidade',
                data: projetosData,
                backgroundColor: projetosColors
            }]
        },
        options: {
            plugins: {
                legend: {
                    display: true,
                    position: 'bottom',
                    labels: { font: { size: 16 }, color: '#333', padding: 20 }
                },
                title: { display: true, text: 'Projetos por Status', font: { size: 20 } },
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
            responsive: true
        }
    });

    // Identidades por Perfil (Rosca)
    const identidades = await fetchIdentidadesPorPerfil();
    const identidadesLabels = identidades.map(i => i.perfil.charAt(0).toUpperCase() + i.perfil.slice(1));
    const identidadesData = identidades.map(i => i.count);
    const identidadesColorsMap = {
        administrador: '#1565c0', 
        visitante: '#f57c00', 
        usuário: '#1b5e20', 
    };
    const identidadesColors = identidades.map(i => identidadesColorsMap[i.perfil.toLowerCase()] || '#888');

    new Chart(document.getElementById('identidadesChart'), {
        type: 'doughnut',
        data: {
            labels: identidadesLabels,
            datasets: [{
                label: 'Quantidade',
                data: identidadesData,
                backgroundColor: identidadesColors
            }]
        },
        options: {
            plugins: {
                legend: {
                    display: true,
                    position: 'bottom',
                    labels: { font: { size: 16 }, color: '#333', padding: 20 }
                },
                title: { display: true, text: 'Identidades por Perfil', font: { size: 20 } },
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
            responsive: true
        }
    });

    // Contratos por Tipo
    const contratoColors = {
        fornecimento: '#4caf50',
        servicos: '#2196f3',
        aditivo: '#ff9800',
        convenio: '#9c27b0',
        outro: '#607d8b'
    };
    const contratos = await fetchContratosPorTipo();
    const contratosLabels = contratos.map(c => c.tipo.charAt(0).toUpperCase() + c.tipo.slice(1));
    const contratosData = contratos.map(c => c.count);
    const contratosColors = contratos.map(c => contratoColors[c.tipo.toLowerCase()] || '#888');

    new Chart(document.getElementById('contratosChart'), {
        type: 'bar',
        data: {
            labels: contratosLabels,
            datasets: [{
                label: 'Quantidade',
                data: contratosData,
                backgroundColor: contratosColors
            }]
        },
        options: {
            plugins: {
                legend: { display: false },
                title: { display: true, text: 'Contratos por Tipo', font: { size: 20 } },
                tooltip: {
                    callbacks: {
                        label: function(ctx) {
                            return `${ctx.label}: ${ctx.raw}`;
                        }
                    }
                }
            },
            indexAxis: 'y',
            responsive: true,
            scales: {
                x: { beginAtZero: true, ticks: { font: { size: 14 } } },
                y: { ticks: { font: { size: 14 } } }
            }
        }
    });
}

// Chame a função ao carregar a página
window.addEventListener('DOMContentLoaded', () => {
    renderCharts().catch(error => {
        console.error('Erro ao carregar os gráficos:', error);
        document.getElementById('dashboard-error').hidden = false;
    });
});
