document.addEventListener('DOMContentLoaded', async () => {
    if (!localStorage.getItem('token')) return;
    const number = new Intl.NumberFormat('pt-BR');
    const palette = { fornecimento: '#20795e', servicos: '#3867aa', aditivo: '#d17a25', convenio: '#7460a9', outro: '#667d91', concluido: '#20795e', andamento: '#3867aa', planejamento: '#d17a25', suspenso: '#b54e5d', administrador: '#3867aa', 'usuário': '#20795e', visitante: '#d17a25' };
    const statusNames = { concluido: 'Concluído', andamento: 'Em andamento', planejamento: 'Planejamento', suspenso: 'Suspenso' };
    let identityChart = null;
    let failed = false;

    async function get(path, fallback) {
        try { return await window.apiGet(path); }
        catch (error) {
            console.error(`Falha ao consultar ${path}:`, error);
            failed = true;
            return fallback;
        }
    }

    function formatDate(value) {
        const match = String(value || '').match(/^(\d{4})-(\d{2})-(\d{2})/);
        return match ? `${match[3]}/${match[2]}/${match[1]}` : '—';
    }

    function showChartMessage(canvas, message) {
        canvas.hidden = true;
        canvas.parentElement.querySelector('.analysis-empty')?.remove();
        const text = document.createElement('p');
        text.className = 'analysis-empty';
        text.textContent = message;
        canvas.parentElement.append(text);
    }

    function renderChart(canvasId, rows, field, type, options = {}) {
        const canvas = document.getElementById(canvasId);
        if (!Array.isArray(rows)) {
            failed = true;
            showChartMessage(canvas, 'Indicador temporariamente indisponível.');
            return;
        }
        if (rows.length === 0) {
            showChartMessage(canvas, 'Não há registros para esta visualização.');
            return;
        }
        if (typeof window.Chart !== 'function') {
            failed = true;
            showChartMessage(canvas, 'Gráfico temporariamente indisponível.');
            return;
        }
        canvas.parentElement.querySelector('.analysis-empty')?.remove();
        canvas.hidden = false;
        const labels = rows.map(row => String(row[field] || 'Não informado').replace(/^./, char => char.toUpperCase()));
        const values = rows.map(row => Number(row.count) || 0);
        const colors = rows.map(row => palette[String(row[field] || '').toLowerCase()] || '#667d91');
        return new window.Chart(canvas, {
            type,
            data: { labels, datasets: [{ data: values, backgroundColor: colors, borderRadius: type === 'bar' ? 7 : 0, maxBarThickness: 60 }] },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                animation: false,
                indexAxis: options.horizontal ? 'y' : 'x',
                plugins: {
                    legend: { display: type !== 'bar', position: 'bottom', labels: { color: '#33465f', padding: 14 } },
                    tooltip: { callbacks: { label: context => `${context.label}: ${number.format(context.parsed?.x ?? context.parsed?.y ?? context.parsed ?? 0)}` } }
                },
                scales: type === 'bar' ? {
                    x: { beginAtZero: true, ticks: { precision: 0, color: '#64758a' }, grid: { color: '#e8edf3' } },
                    y: { ticks: { color: '#33465f' }, grid: { display: false } }
                } : {}
            }
        });
    }

    function renderTable(tbodyId, records, columns, dateField, unavailable = false) {
        const tbody = document.getElementById(tbodyId);
        tbody.replaceChildren();
        if (!Array.isArray(records) || records.length === 0) {
            const row = tbody.insertRow();
            const cell = row.insertCell();
            cell.colSpan = columns.length;
            cell.className = 'empty-row';
            cell.textContent = unavailable ? 'Dados temporariamente indisponíveis.' : 'Nenhum registro encontrado.';
            return;
        }
        [...records].sort((a, b) => String(b[dateField] || '').localeCompare(String(a[dateField] || ''))).slice(0, 10).forEach(record => {
            const row = tbody.insertRow();
            columns.forEach(column => {
                const cell = row.insertCell();
                cell.textContent = column(record);
            });
        });
    }

    const [contractsCount, projectsCount, identitiesCount, contractGroups, projectGroups, identityGroups, contracts, projects, identities] = await Promise.all([
        get('/api/contracts/count', null),
        get('/api/projects/count', null),
        get('/api/identities/count', null),
        get('/api/contracts/groupby/type', null),
        get('/api/projects/groupby/status', null),
        get('/api/identities/groupby/perfil', null),
        get('/api/contracts', null),
        get('/api/projects', null),
        get('/api/identities', null)
    ]);

    [['contratos-ativos', contractsCount], ['projetos-andamento', projectsCount], ['identidades-cadastradas', identitiesCount]].forEach(([id, data]) => {
        const count = data?.count;
        document.getElementById(id).textContent = Number.isSafeInteger(count) && count >= 0 ? number.format(count) : '—';
    });

    renderChart('contratosStatusChart', contractGroups, 'tipo', 'doughnut');
    renderChart('projetosStatusChart', projectGroups, 'status', 'bar', { horizontal: true });

    const filters = document.getElementById('perfil-filtros');
    function updateIdentityChart() {
        if (identityChart) identityChart.destroy();
        const selected = new Set([...filters.querySelectorAll('input:checked')].map(input => input.value.toLowerCase()));
        if (selected.size === 0) {
            showChartMessage(document.getElementById('identidadesChart'), 'Selecione ao menos um perfil.');
            return;
        }
        const rows = Array.isArray(identityGroups) ? identityGroups.filter(row => selected.has(String(row.perfil || '').toLowerCase())) : null;
        identityChart = renderChart('identidadesChart', rows, 'perfil', 'bar');
    }
    filters.addEventListener('change', updateIdentityChart);
    updateIdentityChart();

    const projectRows = Array.isArray(projects?.projects) ? projects.projects : null;
    renderTable('contratos-recentes', contracts, [record => formatDate(record.date), record => String(record.number || '—'), record => String(record.type || '—'), record => String(record.description || '—')], 'date', contracts === null);
    renderTable('projetos-recentes', projectRows, [record => formatDate(record.start_date), record => String(record.name || '—'), record => String(record.code || '—'), record => statusNames[record.status] || String(record.status || '—'), record => String(record.manager || '—')], 'start_date', projectRows === null);
    renderTable('identidades-recentes', identities, [record => formatDate(record.created_at), record => String(record.cpf || '—'), record => String(record.nome || '—'), record => String(record.perfil || '—')], 'created_at', identities === null);

    if (failed) window.appNotice.show(document.getElementById('analises-error'), 'Parte dos dados está indisponível. Confira a conexão e tente novamente.', 'warning');
});
