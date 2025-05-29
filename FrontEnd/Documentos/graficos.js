    const API_BASE_URL = 'http://localhost:3000/api';

    async function fetchCounts(year) {
        const endpoints = [
            { label: 'Contratos', endpoint: `contracts/count?year=${year}` },
            { label: 'Projetos', endpoint: `projects/count?year=${year}` },
            { label: 'Identidades', endpoint: `identities/count?year=${year}` }
        ];
        const results = [];
        for (const item of endpoints) {
            try {
                const res = await fetch(`${API_BASE_URL}/${item.endpoint}`);
                const data = await res.json();
                results.push(data.count || 0);
            } catch {
                results.push(0);
            }
        }
        return results;
    }

    let chart;
    async function renderDashboard(year) {
        const counts = await fetchCounts(year);
        const ctx = document.getElementById('dashboardChart').getContext('2d');
        if (chart) chart.destroy();
        chart = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: ['Contratos', 'Projetos', 'Identidades'],
                datasets: [{
                    label: `Registros em ${year}`,
                    data: counts,
                    backgroundColor: ['#28a745', '#F7AE26', '#F92929'],
                }]
            },
            options: {
                responsive: true,
                plugins: {
                    legend: { display: false },
                    title: { display: true, text: `Documentos Registrados em ${year}` }
                },
                scales: {
                    y: { beginAtZero: true, precision: 0 }
                }
            }
        });
    }

    document.getElementById('yearSelect').addEventListener('change', function() {
        renderDashboard(this.value);
    });

    document.getElementById('downloadChart').addEventListener('click', function() {
        const link = document.createElement('a');
        link.href = chart.toBase64Image();
        link.download = `dashboard-${document.getElementById('yearSelect').value}.png`;
        link.click();
    });

    // Inicialização
    renderDashboard(document.getElementById('yearSelect').value);
