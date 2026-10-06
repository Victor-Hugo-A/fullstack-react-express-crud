document.addEventListener('DOMContentLoaded', async () => {
    const adminCard = document.getElementById('admin-manual-card');
    if (!adminCard) return;

    try {
        const data = await window.apiGet('/api/user');
        adminCard.hidden = data?.success !== true || data.user?.isAdmin !== true;
    } catch {
        adminCard.hidden = true;
    }
});
