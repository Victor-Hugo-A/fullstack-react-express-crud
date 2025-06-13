const session = require('express-session');
const Keycloak = require('keycloak-connect');

// Configuração de sessão
const memoryStore = new session.MemoryStore();
const keycloakConfig = {
  realm: 'meu-realm',
  'auth-server-url': 'http://localhost:8080',
  'ssl-required': 'external',
  resource: 'nodejs-app', // Client ID criado no Keycloak
  'public-client': true, // Use "false" em produção com client secret
  'confidential-port': 0,
    policyEnforcer: {
    enforcermentMode: 'ENFORCING'
  },
  "enable-pkce": true,
  "verify-token-audience": true,
  "use-resource-role-mappings": true
};

const keycloak = new Keycloak({ store: memoryStore }, keycloakConfig);

module.exports = keycloak;