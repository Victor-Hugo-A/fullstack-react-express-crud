document.addEventListener('DOMContentLoaded', async () => {
    if (!localStorage.getItem('token')) return;
    const colors = {
        fornecimento: '#20795e', servicos: '#3867aa', aditivo: '#d17a25', convenio: '#7460a9', outro: '#667d91',
        concluido: '#20795e', andamento: '#3867aa', planejamento: '#d17a25', suspenso: '#b54e5d',
        administrador: '#3867aa', 'usuário': '#20795e', visitante: '#d17a25'
    };
    const formatNumber = new Intl.NumberFormat('pt-BR');

    function showEmpty(canvas, message) {
        canvas.hidden = true;
        const text = document.createElement('p');
        text.className = 'chart-empty';
        text.textContent = message;
        canvas.parentElement.append(text);
    }

    async function loadChart(path, canvasId, field, type, horizontal = false) {
        const canvas = document.getElementById(canvasId);
        try {
            const rows = await window.apiGet(path);
            if (!Array.isArray(rows)) throw new Error('Resposta inválida.');
            if (rows.length === 0) {
                showEmpty(canvas, 'Não há registros para esta visualização.');
                return true;
            }
            if (typeof window.Chart !== 'function') throw new Error('Gráficos indisponíveis.');

            const labels = rows.map(row => String(row[field] || 'Não informado').replace(/^./, char => char.toUpperCase()));
            const values = rows.map(row => Number(row.count) || 0);
            const barColors = rows.map(row => colors[String(row[field] || '').toLowerCase()] || '#667d91');
            new window.Chart(canvas, {
                type,
                data: { labels, datasets: [{ data: values, backgroundColor: barColors, borderRadius: type === 'bar' ? 7 : 0, maxBarThickness: 56 }] },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    animation: false,
                    indexAxis: horizontal ? 'y' : 'x',
                    plugins: {
                        legend: { display: type !== 'bar', position: 'bottom', labels: { color: '#33465f', padding: 16 } },
                        tooltip: { callbacks: { label: context => `${context.label}: ${formatNumber.format(context.parsed?.x ?? context.parsed ?? 0)}` } }
                    },
                    scales: type === 'bar' ? {
                        x: { beginAtZero: true, ticks: { precision: 0, color: '#64758a' }, grid: { color: '#e8edf3' } },
                        y: { ticks: { color: '#33465f' }, grid: { display: false } }
                    } : {}
                }
            });
            return true;
        } catch (error) {
            console.error(`Falha ao carregar ${canvasId}:`, error);
            showEmpty(canvas, 'Indicador temporariamente indisponível.');
            return false;
        }
    }

    const results = await Promise.all([
        loadChart('/api/contracts/groupby/type', 'contratosChart', 'tipo', 'bar', true),
        loadChart('/api/projects/groupby/status', 'projetosChart', 'status', 'pie'),
        loadChart('/api/identities/groupby/perfil', 'identidadesChart', 'perfil', 'doughnut')
    ]);
    if (results.some(result => !result)) {
        window.appNotice.show(document.getElementById('dashboard-error'), 'Alguns indicadores não puderam ser carregados. Verifique a conexão e tente novamente.', 'warning');
    }
});
