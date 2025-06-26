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
  'logout-redirect-uri': 'http://localhost:8080/realms/meu-realm/protocol/openid-connect/auth?client_id=nodejs-app&redirect_uri=http%3A%2F%2F127.0.0.1%3A5500%2FFrontEnd%2FSistema%2Fsistema.html&state=28078f18-99c7-440f-b7e8-8e35362b1569&response_mode=fragment&response_type=code&scope=openid&nonce=29d830d6-0919-4fd5-818e-dba4654e9987&code_challenge=Q481uVNwgQ3RGF7arVJIMk8lMPeW_yI04rRRpeimGjA&code_challenge_method=S256',
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