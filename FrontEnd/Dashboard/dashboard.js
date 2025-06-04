    const API_BASE_URL = 'http://localhost:3000/api';

    // Funções para buscar dados agrupados do backend
    async function fetchContratosPorTipo() {
        // Exemplo de resposta esperada: [{ tipo: 'aditivo', count: 5 }, ...]
        const res = await fetch(`${API_BASE_URL}/contracts/groupby/type`);
        const data = res.ok ? await res.json() : [];
        return data;
    }

    async function fetchProjetosPorStatus() {
        // Exemplo de resposta esperada: [{ status: 'andamento', count: 3 }, ...]
        const res = await fetch(`${API_BASE_URL}/projects/groupby/status`);
        return res.ok ? await res.json() : [];
    }
    
    async function fetchIdentidadesPorPerfil() {
        // Exemplo de resposta esperada: [{ perfil: 'administrador', count: 2 }, ...]
        const res = await fetch(`${API_BASE_URL}/identities/groupby/perfil`);
        return res.ok ? await res.json() : [];
    }

    // Renderização dos gráficos
    async function renderCharts() {

        // Contratos por tipo
        const contratos = await fetchContratosPorTipo();
        const contratosFiltrados = contratos.filter(c => c.tipo && c.count);

        // Cria um dataset para cada tipo de contrato
        new Chart(document.getElementById('contratosChart'), {
            type: 'bar',
            data: {
                labels: contratosFiltrados.map(c => c.tipo.charAt(0).toUpperCase() + c.tipo.slice(1)),
                datasets: [{
                    label: 'Quantidade',
                    data: contratosFiltrados.map(c => c.count),
                    backgroundColor: [
                        '#ff9800', '#9c27b0', '#4caf50', '#607d8b', '#2196f3'
                    ]
                }]
            },
            options: {
                indexAxis: 'y',
                plugins: {
                    legend: { display: false }, // Mostra a legenda com os tipos
                    title: { display: true, text: 'Contratos por Tipo' }
                },
                scales: {
                    x: { beginAtZero: true, ticks: { font: { size: 14 } } },
                    y: { ticks: { font: { size: 14 } } }
                },
                responsive: true,
            }
        });


        // Projetos por status
        const projetos = await fetchProjetosPorStatus();
        new Chart(document.getElementById('projetosChart'), {
            type: 'pie',
            data: {
                labels: projetos.map(p => p.status.charAt(0).toUpperCase() + p.status.slice(1)),
                datasets: [{
                    label: 'Quantidade',
                    data: projetos.map(p => p.count),
                    backgroundColor: ['#0288d1', '#2e7d32', '#ed6c02', '#d32f2f']
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
        new Chart(document.getElementById('identidadesChart'), {
            type: 'doughnut',
            data: {
                labels: identidades.map(i => i.perfil.charAt(0).toUpperCase() + i.perfil.slice(1)),
                datasets: [{
                    label: 'Quantidade',
                    data: identidades.map(i => i.count),
                    backgroundColor: ['#1565c0', '#1b5e20', '#f57c00', '#8e24aa']
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
    }
renderCharts();