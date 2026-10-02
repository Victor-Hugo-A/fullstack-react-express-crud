const session = require('express-session');
const Keycloak = require('keycloak-connect');

// Configuração de sessão
const memoryStore = new session.MemoryStore();

const keycloakConfig = {
  realm: process.env.KEYCLOAK_REALM || 'meu-realm',
  'auth-server-url': process.env.KEYCLOAK_URL || 'http://localhost:8080',
  'ssl-required': 'external',
  resource: process.env.KEYCLOAK_CLIENT_ID || 'nodejs-app',
  'public-client': !process.env.KEYCLOAK_CLIENT_SECRET,
  'confidential-port': 0,
  'enable-pkce': true,
  'verify-token-audience': true,
  'use-resource-role-mappings': true,
  'bearer-only': false,
  'credentials': {
    'secret': process.env.KEYCLOAK_CLIENT_SECRET || ''
  }
};

const keycloak = new Keycloak({ store: memoryStore }, keycloakConfig);

// Configuração adicional do middleware
keycloak.redirectToLogin = () => {
  return (req, res, next) => {
    if (!req.kauth.grant) {
      const loginUrl = keycloak.loginUrl(
        process.env.KEYCLOAK_REDIRECT_URI || 'http://localhost:3000',
        process.env.KEYCLOAK_CLIENT_ID || 'nodejs-app'
      );
      return res.redirect(loginUrl);
    }
    next();
  };
};

module.exports = keycloak;
