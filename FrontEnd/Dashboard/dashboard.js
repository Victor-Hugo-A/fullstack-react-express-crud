document.addEventListener('DOMContentLoaded', () => {
    if (!localStorage.getItem('token')) return;

    const number = new Intl.NumberFormat('pt-BR');
    const dateTime = new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' });
    const palette = {
        fornecimento: '#20795e', servicos: '#3867aa', servico: '#3867aa', aditivo: '#d17a25', convenio: '#7460a9', outro: '#667d91',
        concluido: '#20795e', andamento: '#3867aa', planejamento: '#d17a25', suspenso: '#b54e5d',
        administrador: '#3867aa', 'usuário': '#20795e', visitante: '#d17a25'
    };
    const names = { concluido: 'Concluído', andamento: 'Em andamento', planejamento: 'Planejamento', suspenso: 'Suspenso', servicos: 'Serviços', servico: 'Serviço', convenio: 'Convênio' };
    const charts = new Map();
    const refreshButton = document.getElementById('refresh-dashboard');
    const errorElement = document.getElementById('dashboard-error');
    const valueLabelsPlugin = {
        id: 'dashboardValueLabels',
        afterDatasetsDraw(chart) {
            if (chart.config.type !== 'bar') return;
            const { ctx, chartArea } = chart;
            const horizontal = chart.options.indexAxis === 'y';
            const values = chart.data.datasets[0].data;
            const elements = chart.getDatasetMeta(0).data;
            ctx.save();
            ctx.fillStyle = '#33465f';
            ctx.font = '600 12px system-ui, sans-serif';
            elements.forEach((element, index) => {
                const value = number.format(values[index]);
                let x = horizontal ? element.x + 8 : element.x;
                let y = horizontal ? element.y : element.y - 8;
                ctx.textAlign = horizontal ? 'left' : 'center';
                ctx.textBaseline = horizontal ? 'middle' : 'bottom';
                if (horizontal && x + ctx.measureText(value).width > chartArea.right) {
                    x = element.x - 8;
                    ctx.textAlign = 'right';
                }
                if (!horizontal && y < chartArea.top + 12) y = element.y + 14;
                ctx.fillText(value, x, y);
            });
            ctx.restore();
        }
    };

    function label(value) {
        const normalized = String(value || 'Não informado').trim();
        return names[normalized.toLowerCase()] || normalized.replace(/^./, character => character.toUpperCase());
    }

    function totalText(value) {
        return `${number.format(value)} registro${value === 1 ? '' : 's'}`;
    }

    function formatDate(value) {
        const date = new Date(value);
        return Number.isNaN(date.getTime()) ? 'Data não informada' : dateTime.format(date);
    }

    function resetChart(canvas) {
        charts.get(canvas.id)?.destroy();
        charts.delete(canvas.id);
        canvas.hidden = false;
        canvas.parentElement.querySelector('.chart-empty')?.remove();
    }

    function showChartMessage(canvas, message) {
        resetChart(canvas);
        canvas.hidden = true;
        const empty = document.createElement('p');
        empty.className = 'chart-empty';
        empty.textContent = message;
        canvas.parentElement.append(empty);
    }

    function renderChart(canvasId, rows, field, type, options = {}) {
        const canvas = document.getElementById(canvasId);
        if (!Array.isArray(rows) || rows.length === 0) {
            showChartMessage(canvas, 'Não há registros para esta visualização.');
            return;
        }
        if (typeof window.Chart !== 'function') {
            showChartMessage(canvas, 'Gráfico temporariamente indisponível.');
            return;
        }
        resetChart(canvas);
        const values = rows.map(row => Math.max(0, Number(row.count) || 0));
        const labels = rows.map((row, index) => {
            const text = label(row[field]);
            return type === 'bar' ? text : `${text} (${number.format(values[index])})`;
        });
        const colors = rows.map(row => palette[String(row[field] || '').toLowerCase()] || '#667d91');
        const chart = new window.Chart(canvas, {
            type,
            data: { labels, datasets: [{ data: values, backgroundColor: colors, borderRadius: type === 'bar' ? 8 : 0, maxBarThickness: 52, borderWidth: type === 'bar' ? 0 : 2, borderColor: '#fff' }] },
            plugins: [valueLabelsPlugin],
            options: {
                responsive: true,
                maintainAspectRatio: false,
                animation: false,
                indexAxis: options.horizontal ? 'y' : 'x',
                plugins: {
                    legend: { display: type !== 'bar', position: 'bottom', labels: { boxWidth: 10, color: '#425a70', padding: 14, usePointStyle: true } },
                    tooltip: { callbacks: { label: context => `${context.label}: ${number.format(context.parsed?.x ?? context.parsed?.y ?? context.parsed ?? 0)}` } }
                },
                scales: type === 'bar' ? {
                    x: { beginAtZero: true, ticks: { precision: 0, color: '#64758a' }, grid: { color: '#e8edf3' } },
                    y: { ticks: { color: '#33465f' }, grid: { display: false } }
                } : {}
            }
        });
        charts.set(canvasId, chart);
    }

    function setMetrics(totals) {
        const metricIds = { contracts: 'metric-contracts', projects: 'metric-projects', identities: 'metric-identities', all: 'metric-total' };
        Object.entries(metricIds).forEach(([key, id]) => {
            document.getElementById(id).textContent = number.format(Number(totals[key]) || 0);
        });
        [['contracts-total', totals.contracts], ['projects-total', totals.projects], ['identities-total', totals.identities]].forEach(([id, value]) => {
            document.getElementById(id).textContent = totalText(Number(value) || 0);
        });
    }

    function renderActivity(records) {
        const list = document.getElementById('recent-activity');
        list.replaceChildren();
        if (!Array.isArray(records) || records.length === 0) {
            const empty = document.createElement('li');
            empty.className = 'activity-empty';
            empty.textContent = 'Ainda não há registros recentes para exibir.';
            list.append(empty);
            return;
        }
        records.forEach(record => {
            const item = document.createElement('li');
            const marker = document.createElement('span');
            marker.className = `activity-marker activity-marker--${record.kind || 'contract'}`;
            marker.setAttribute('aria-hidden', 'true');
            const copy = document.createElement('div');
            copy.className = 'activity-copy';
            const title = document.createElement('strong');
            title.textContent = record.title || 'Registro sem identificação';
            const detail = document.createElement('span');
            detail.textContent = label(record.detail);
            copy.append(title, detail);
            const time = document.createElement('time');
            time.textContent = formatDate(record.date);
            item.append(marker, copy, time);
            list.append(item);
        });
    }

    async function loadDashboard() {
        refreshButton.disabled = true;
        refreshButton.innerHTML = 'Atualizando…';
        try {
            const data = await window.apiGet('/api/dashboard/summary');
            if (!data?.totals || !data?.groups) throw new Error('Resposta inválida.');
            setMetrics(data.totals);
            renderChart('contratosChart', data.groups.contracts, 'tipo', 'bar', { horizontal: true });
            renderChart('projetosChart', data.groups.projects, 'status', 'doughnut');
            renderChart('identidadesChart', data.groups.identities, 'perfil', 'bar');
            renderActivity(data.recent);
            document.getElementById('dashboard-updated').textContent = `Atualizado em ${formatDate(data.updatedAt)}`;
            window.appNotice?.hide(errorElement);
        } catch (error) {
            console.error('Falha ao carregar dashboard:', error);
            ['contratosChart', 'projetosChart', 'identidadesChart'].forEach(id => showChartMessage(document.getElementById(id), 'Indicador temporariamente indisponível.'));
            document.getElementById('dashboard-updated').textContent = 'Não foi possível atualizar os dados.';
            renderActivity([]);
            window.appNotice?.show(errorElement, 'Não foi possível carregar os indicadores. Verifique a conexão e tente novamente.', 'warning');
        } finally {
            refreshButton.disabled = false;
            refreshButton.innerHTML = 'Atualizar dados <span aria-hidden="true">↻</span>';
        }
    }

    refreshButton.addEventListener('click', loadDashboard);
    loadDashboard();
});
