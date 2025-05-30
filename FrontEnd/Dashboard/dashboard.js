    const API_BASE_URL = 'http://localhost:3000/api';

    // Funções para buscar dados agrupados do backend
    async function fetchContratosPorTipo() {
        // Exemplo de resposta esperada: [{ tipo: 'aditivo', count: 5 }, ...]
        const res = await fetch(`${API_BASE_URL}/contracts/groupby/type`);
        return res.ok ? await res.json() : [];
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
        new Chart(document.getElementById('contratosChart'), {
            type: 'bar',
            data: {
                labels: contratos.map(c => c.tipo.charAt(0).toUpperCase() + c.tipo.slice(1)),
                datasets: [{
                    label: 'Quantidade',
                    data: contratos.map(c => c.count),
                    backgroundColor: [
                        '#007bff', '#28a745', '#ffc107', '#dc3545'
                    ]
                }]
            },
            options: {
                plugins: { title: { display: true, text: 'Contratos por Tipo' } },
                responsive: true,
                scales: { y: { beginAtZero: true, precision: 0 } }
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
                    backgroundColor: [
                        '#17a2b8', '#ffc107', '#6c757d', '#28a745'
                    ]
                }]
            },
            options: {
                plugins: { title: { display: true, text: 'Projetos por Status' } },
                responsive: true
            }
        });

        // Identidades por perfil
        const identidades = await fetchIdentidadesPorPerfil();
        new Chart(document.getElementById('identidadesChart'), {
            type: 'doughnut',
            data: {
                labels: identidades.map(i => i.perfil.charAt(0).toUpperCase() + i.perfil.slice(1)),
                datasets: [{
                    label: 'Quantidade',
                    data: identidades.map(i => i.count),
                    backgroundColor: [
                        '#6610f2', '#fd7e14', '#20c997'
                    ]
                }]
            },
            options: {
                plugins: { title: { display: true, text: 'Identidades por Perfil' } },
                responsive: true
            }
        });
    }

    renderCharts();