(() => {
    'use strict';

    const categories = [
        { label: 'Contratos', path: 'contracts', metric: 'metric-contracts', color: '#20795e' },
        { label: 'Projetos', path: 'projects', metric: 'metric-projects', color: '#d17a25' },
        { label: 'Identidades', path: 'identities', metric: 'metric-identities', color: '#3867aa' }
    ];
    const yearSelect = document.getElementById('yearSelect');
    const status = document.getElementById('graphics-status');
    const error = document.getElementById('graficos-error');
    const empty = document.getElementById('graphics-empty');
    const downloadButton = document.getElementById('downloadChart');
    const canvas = document.getElementById('dashboardChart');
    const chartContainer = document.getElementById('dashboardChart-container');
    const formatNumber = new Intl.NumberFormat('pt-BR');
    let chart = null;
    let requestId = 0;

    function setupYears() {
        const currentYear = new Date().getFullYear();
        for (let year = currentYear; year >= currentYear - 5; year -= 1) {
            const option = document.createElement('option');
            option.value = String(year);
            option.textContent = String(year);
            yearSelect.append(option);
        }
    }

    async function loadUsername() {
        try {
            const data = await window.apiGet('/api/user');
            const name = data.user?.nome || data.user?.username;
            if (name) document.getElementById('username-display').textContent = name;
        } catch {
            // A falha no perfil não impede a consulta dos indicadores.
        }
    }

    function resetDisplay() {
        if (chart) {
            chart.destroy();
            chart = null;
        }
        categories.forEach(({ metric }) => {
            document.getElementById(metric).textContent = '—';
        });
        status.hidden = false;
        status.textContent = 'Carregando dados...';
        window.appNotice.hide(error);
        empty.hidden = true;
        chartContainer.hidden = true;
        downloadButton.disabled = true;
    }

    async function renderDashboard(year) {
        const thisRequest = ++requestId;
        resetDisplay();

        const results = await Promise.allSettled(categories.map(({ path }) =>
            window.apiGet(`/api/${path}/count?year=${encodeURIComponent(year)}`)
        ));
        if (thisRequest !== requestId) return;

        const counts = results.map((result) => {
            if (result.status !== 'fulfilled') return null;
            const count = result.value?.count;
            return Number.isSafeInteger(count) && count >= 0 ? count : null;
        });
        const failed = counts.filter((count) => count === null).length;
        const total = counts.reduce((sum, count) => sum + (count ?? 0), 0);

        categories.forEach(({ metric }, index) => {
            document.getElementById(metric).textContent = counts[index] === null
                ? 'Indisponível'
                : formatNumber.format(counts[index]);
        });

        if (failed === categories.length) {
            status.hidden = true;
            window.appNotice.show(error, 'Não foi possível carregar os indicadores. Verifique a conexão e tente novamente.', 'warning');
            return;
        }

        status.textContent = `${year} · ${formatNumber.format(total)} registro${total === 1 ? '' : 's'} ${failed ? 'disponíveis' : 'no total'}`;
        if (failed) {
            window.appNotice.show(error, 'Parte dos dados está indisponível. Os valores exibidos não representam o total completo.', 'warning');
        }
        empty.hidden = failed > 0 || total !== 0;

        if (typeof window.Chart !== 'function') {
            window.appNotice.show(error, 'Os indicadores foram carregados, mas o gráfico está indisponível nesta conexão.', 'warning');
            return;
        }

        chartContainer.hidden = false;
        chart = new window.Chart(canvas, {
            type: 'bar',
            data: {
                labels: categories.map(({ label }) => label),
                datasets: [{
                    data: counts,
                    backgroundColor: categories.map(({ color }) => color),
                    borderRadius: 8,
                    maxBarThickness: 96
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                animation: false,
                plugins: {
                    legend: { display: false },
                    tooltip: { callbacks: { label: (context) => `${formatNumber.format(context.parsed.y)} registros` } }
                },
                scales: {
                    x: { grid: { display: false }, ticks: { color: '#33465f', font: { weight: '600' } } },
                    y: { beginAtZero: true, ticks: { precision: 0, color: '#687a91' }, grid: { color: '#e8edf3' } }
                }
            }
        });
        downloadButton.disabled = failed > 0;
    }

    function downloadChart() {
        if (!chart || downloadButton.disabled) return;
        try {
            const exportCanvas = document.createElement('canvas');
            exportCanvas.width = canvas.width;
            exportCanvas.height = canvas.height;
            const context = exportCanvas.getContext('2d');
            context.fillStyle = '#ffffff';
            context.fillRect(0, 0, exportCanvas.width, exportCanvas.height);
            context.drawImage(canvas, 0, 0);

            const link = document.createElement('a');
            link.href = exportCanvas.toDataURL('image/png');
            link.download = `documentos-${yearSelect.value}.png`;
            link.click();
        } catch {
            window.appNotice.show(error, 'Não foi possível baixar o gráfico. Tente novamente.', 'error');
        }
    }

    setupYears();
    loadUsername();
    yearSelect.addEventListener('change', () => renderDashboard(yearSelect.value));
    downloadButton.addEventListener('click', downloadChart);
    renderDashboard(yearSelect.value);
})();
