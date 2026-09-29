(() => {
    function render(container, currentPage, totalPages) {
        if (!container) return;
        container.replaceChildren();
        container.hidden = totalPages <= 1;
        if (totalPages <= 1) return;

        function button(text, page, label, className, disabled = false) {
            const element = document.createElement('button');
            element.type = 'button';
            element.className = className;
            element.dataset.page = String(page);
            element.textContent = text;
            element.setAttribute('aria-label', label);
            element.disabled = disabled;
            container.append(element);
            return element;
        }

        button('‹', 'prev', 'Página anterior', 'page-nav', currentPage <= 1);
        const visible = new Set([1, totalPages]);
        for (let page = Math.max(1, currentPage - 1); page <= Math.min(totalPages, currentPage + 1); page++) visible.add(page);
        let previous = 0;
        [...visible].sort((a, b) => a - b).forEach(page => {
            if (previous && page - previous > 1) {
                const ellipsis = document.createElement('span');
                ellipsis.className = 'page-ellipsis';
                ellipsis.textContent = '…';
                ellipsis.setAttribute('aria-hidden', 'true');
                container.append(ellipsis);
            }
            const item = button(String(page), page, `Página ${page}`, 'page-link');
            if (page === currentPage) {
                item.classList.add('active');
                item.setAttribute('aria-current', 'page');
            }
            previous = page;
        });
        button('›', 'next', 'Próxima página', 'page-nav', currentPage >= totalPages);
    }

    window.documentPagination = { render };
})();
