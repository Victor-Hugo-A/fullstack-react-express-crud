const session = require('express-session');
const Keycloak = require('keycloak-connect');

// Configuração de sessão
const memoryStore = new session.MemoryStore();

const keycloakConfig = {
  realm: 'meu-realm',
  'auth-server-url': 'http://localhost:8080',
  'ssl-required': 'external',
  resource: 'nodejs-app',
  'public-client': false,
  'confidential-port': 0,
  'enable-pkce': true,
  'verify-token-audience': true,
  'use-resource-role-mappings': true,
  // Adicione a configuração de logout
  'logout-redirect-uri': 'http://localhost:8080/realms/meu-realm/protocol/openid-connect/auth',
  // Configurações adicionais recomendadas
  'bearer-only': false,
  'credentials': {
    'secret': '' // Mantenha vazio se for public client
  }
};

const keycloak = new Keycloak({ store: memoryStore }, keycloakConfig);

// Configuração adicional do middleware
keycloak.redirectToLogin = () => {
  return (req, res, next) => {
    if (!req.kauth.grant) {
      const loginUrl = keycloak.loginUrl(
        'http://localhost:3000', // URL de retorno após login
        'nodejs-app'
      );
      return res.redirect(loginUrl);
    }
    next();
  };
};

module.exports = keycloak;