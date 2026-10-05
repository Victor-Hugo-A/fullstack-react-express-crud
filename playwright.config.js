const { defineConfig, devices } = require('@playwright/test');

module.exports = defineConfig({
    testDir: './tests/e2e',
    timeout: 30_000,
    fullyParallel: true,
    forbidOnly: Boolean(process.env.CI),
    retries: process.env.CI ? 2 : 0,
    reporter: process.env.CI ? [['html', { open: 'never' }], ['github']] : 'list',
    use: {
        baseURL: 'http://127.0.0.1:5501',
        trace: 'on-first-retry'
    },
    projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
    webServer: {
        command: 'node scripts/serve-front.js',
        url: 'http://127.0.0.1:5501/FrontEnd/login.html',
        reuseExistingServer: !process.env.CI,
        env: { ...process.env, FRONTEND_PORT: '5501' }
    }
});
