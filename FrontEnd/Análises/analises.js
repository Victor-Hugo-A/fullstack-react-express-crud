document.addEventListener('DOMContentLoaded', () => {
    if (!sessionStorage.getItem('portal-session')) return;

    const number = new Intl.NumberFormat('pt-BR');
    const dateOnly = new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short' });
    const dateTime = new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' });
    const palette = { fornecimento: '#20795e', servicos: '#3867aa', servico: '#3867aa', aditivo: '#d17a25', convenio: '#7460a9', outro: '#667d91', concluido: '#20795e', andamento: '#3867aa', planejamento: '#d17a25', suspenso: '#b54e5d', administrador: '#3867aa', 'usuário': '#20795e', visitante: '#d17a25' };
    const statusNames = { concluido: 'Concluído', andamento: 'Em andamento', planejamento: 'Planejamento', suspenso: 'Suspenso', servicos: 'Serviços', servico: 'Serviço', convenio: 'Convênio' };
    const charts = new Map();
    const filters = document.getElementById('perfil-filtros');
    let identityGroups = [];
    const valueLabelsPlugin = {
        id: 'analysisValueLabels',
        afterDatasetsDraw(chart) {
            if (chart.config.type !== 'bar') return;
            const { ctx, chartArea } = chart;
            const horizontal = chart.options.indexAxis === 'y';
            const values = chart.data.datasets[0].data;
            ctx.save(); ctx.fillStyle = '#33465f'; ctx.font = '600 12px system-ui, sans-serif';
            chart.getDatasetMeta(0).data.forEach((element, index) => {
                const value = number.format(values[index]);
                let x = horizontal ? element.x + 8 : element.x;
                let y = horizontal ? element.y : element.y - 8;
                ctx.textAlign = horizontal ? 'left' : 'center'; ctx.textBaseline = horizontal ? 'middle' : 'bottom';
                if (horizontal && x + ctx.measureText(value).width > chartArea.right) { x = element.x - 8; ctx.textAlign = 'right'; }
                if (!horizontal && y < chartArea.top + 12) y = element.y + 14;
                ctx.fillText(value, x, y);
            });
            ctx.restore();
        }
    };

    function label(value) { const text = String(value || 'Não informado').trim(); return statusNames[text.toLowerCase()] || text.replace(/^./, character => character.toUpperCase()); }
    function formatDate(value) {
        const text = String(value || '').trim();
        const dateOnlyMatch = text.match(/^(\d{4})-(\d{2})-(\d{2})$/);
        if (dateOnlyMatch) return `${dateOnlyMatch[3]}/${dateOnlyMatch[2]}/${dateOnlyMatch[1]}`;
        const date = new Date(text);
        return Number.isNaN(date.getTime()) ? '—' : dateTime.format(date);
    }
    function totalText(value) { return `${number.format(value)} registro${value === 1 ? '' : 's'}`; }
    function removeChart(canvas) { charts.get(canvas.id)?.destroy(); charts.delete(canvas.id); canvas.hidden = false; canvas.parentElement.querySelector('.analysis-empty')?.remove(); }
    function showChartMessage(canvas, message) { removeChart(canvas); canvas.hidden = true; const text = document.createElement('p'); text.className = 'analysis-empty'; text.textContent = message; canvas.parentElement.append(text); }

    function renderChart(canvasId, rows, field, type, options = {}) {
        const canvas = document.getElementById(canvasId);
        if (!Array.isArray(rows) || rows.length === 0) return showChartMessage(canvas, 'Não há registros para esta visualização.');
        if (typeof window.Chart !== 'function') return showChartMessage(canvas, 'Gráfico temporariamente indisponível.');
        removeChart(canvas);
        const values = rows.map(row => Math.max(0, Number(row.count) || 0));
        const labels = rows.map((row, index) => type === 'bar' ? label(row[field]) : `${label(row[field])} (${number.format(values[index])})`);
        const chart = new window.Chart(canvas, {
            type, plugins: [valueLabelsPlugin],
            data: { labels, datasets: [{ data: values, backgroundColor: rows.map(row => palette[String(row[field] || '').toLowerCase()] || '#667d91'), borderRadius: type === 'bar' ? 8 : 0, maxBarThickness: 52, borderWidth: type === 'bar' ? 0 : 2, borderColor: '#fff' }] },
            options: { responsive: true, maintainAspectRatio: false, animation: false, indexAxis: options.horizontal ? 'y' : 'x', plugins: { legend: { display: type !== 'bar', position: 'bottom', labels: { boxWidth: 10, color: '#425a70', padding: 14, usePointStyle: true } }, tooltip: { callbacks: { label: context => `${context.label}: ${number.format(context.parsed?.x ?? context.parsed?.y ?? context.parsed ?? 0)}` } } }, scales: type === 'bar' ? { x: { beginAtZero: true, ticks: { precision: 0, color: '#64758a' }, grid: { color: '#e8edf3' } }, y: { ticks: { color: '#33465f' }, grid: { display: false } } } : {} }
        });
        charts.set(canvasId, chart);
    }

    function renderMetrics(totals) {
        [['metric-contracts', totals.contracts], ['metric-projects', totals.projects], ['metric-identities', totals.identities], ['metric-completed', totals.completedProjects], ['metric-overdue', totals.overdueProjects]].forEach(([id, value]) => { document.getElementById(id).textContent = number.format(Number(value) || 0); });
        const rate = totals.projects ? Math.round((totals.completedProjects / totals.projects) * 100) : 0;
        document.getElementById('completed-rate').textContent = `${rate}% do total de projetos`;
        [['contracts-total', totals.contracts], ['projects-total', totals.projects], ['identities-total', totals.identities]].forEach(([id, value]) => { document.getElementById(id).textContent = totalText(Number(value) || 0); });
    }

    function renderProfileFilters() {
        const selected = new Set([...filters.querySelectorAll('input:checked')].map(input => input.value));
        filters.replaceChildren();
        identityGroups.forEach(row => {
            const profile = String(row.perfil || 'Não informado');
            const chip = document.createElement('label'); chip.className = 'analysis-filter-chip';
            const input = document.createElement('input'); input.type = 'checkbox'; input.value = profile; input.checked = selected.size === 0 || selected.has(profile);
            const text = document.createElement('span'); text.textContent = `${label(profile)} (${number.format(Number(row.count) || 0)})`;
            chip.append(input, text); filters.append(chip);
        });
        if (identityGroups.length) { const clear = document.createElement('button'); clear.type = 'button'; clear.className = 'clear-profiles'; clear.textContent = 'Limpar filtros'; clear.addEventListener('click', () => { filters.querySelectorAll('input').forEach(input => { input.checked = false; }); updateIdentityChart(); }); filters.append(clear); }
        filters.onchange = updateIdentityChart;
    }

    function updateIdentityChart() {
        const selected = new Set([...filters.querySelectorAll('input:checked')].map(input => input.value));
        renderChart('identidadesChart', identityGroups.filter(row => selected.has(String(row.perfil || 'Não informado'))), 'perfil', 'bar');
    }

    function renderTable(tbodyId, records, columns) {
        const tbody = document.getElementById(tbodyId); tbody.replaceChildren();
        if (!Array.isArray(records) || records.length === 0) { const row = tbody.insertRow(); const cell = row.insertCell(); cell.colSpan = columns.length; cell.className = 'empty-row'; cell.textContent = 'Nenhum registro encontrado para este período.'; return; }
        records.forEach(record => { const row = tbody.insertRow(); columns.forEach(column => { const cell = row.insertCell(); const value = column(record); if (value instanceof Node) cell.append(value); else cell.textContent = value; }); });
    }

    function statusBadge(status) { const badge = document.createElement('span'); const key = String(status || '').toLowerCase(); badge.className = `status-badge status-badge--${key}`; badge.textContent = label(status); return badge; }
    function setupTabs() { document.querySelectorAll('.analysis-tabs [role="tab"]').forEach(tab => tab.addEventListener('click', () => { document.querySelectorAll('.analysis-tabs [role="tab"]').forEach(button => button.setAttribute('aria-selected', String(button === tab))); document.querySelectorAll('.tab-panel').forEach(panel => { panel.hidden = panel.id !== tab.getAttribute('aria-controls'); }); })); }

    async function loadAnalysis() {
        const from = document.getElementById('period-from').value;
        const to = document.getElementById('period-to').value;
        const query = new URLSearchParams(); if (from) query.set('from', from); if (to) query.set('to', to);
        try {
            const data = await window.apiGet(`/api/analysis/summary?${query.toString()}`);
            if (!data?.totals || !data?.groups || !data?.recent) throw new Error('Resposta inválida.');
            renderMetrics(data.totals); identityGroups = data.groups.identities;
            renderChart('contratosStatusChart', data.groups.contracts, 'tipo', 'bar', { horizontal: true });
            renderChart('projetosStatusChart', data.groups.projects, 'status', 'bar', { horizontal: true });
            renderProfileFilters(); updateIdentityChart();
            renderTable('contratos-recentes', data.recent.contracts, [record => formatDate(record.date), record => String(record.number || '—'), record => label(record.type), record => String(record.description || '—')]);
            renderTable('projetos-recentes', data.recent.projects, [record => formatDate(record.start_date), record => String(record.name || '—'), record => String(record.code || '—'), record => statusBadge(record.status), record => String(record.manager || '—')]);
            renderTable('identidades-recentes', data.recent.identities, [record => formatDate(record.created_at), record => String(record.cpf || '—'), record => String(record.nome || '—'), record => label(record.perfil)]);
            document.getElementById('analysis-updated').textContent = `Atualizado em ${formatDate(data.updatedAt)}`; window.appNotice?.hide(document.getElementById('analises-error'));
        } catch (error) {
            console.error('Falha ao carregar análises:', error); document.getElementById('analysis-updated').textContent = 'Não foi possível atualizar os dados.'; window.appNotice?.show(document.getElementById('analises-error'), 'Não foi possível carregar as análises. Verifique a conexão e tente novamente.', 'warning');
        }
    }

    document.getElementById('analysis-period').addEventListener('submit', event => { event.preventDefault(); loadAnalysis(); });
    document.getElementById('clear-period').addEventListener('click', () => { document.getElementById('period-from').value = ''; document.getElementById('period-to').value = ''; loadAnalysis(); });
    setupTabs(); loadAnalysis();
});
