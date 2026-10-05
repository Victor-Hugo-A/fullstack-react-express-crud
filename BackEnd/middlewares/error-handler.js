const multer = require('multer');

function errorHandler(error, req, res, next) {
  if (res.headersSent) return next(error);

  if (error instanceof multer.MulterError) {
    const tooLarge = error.code === 'LIMIT_FILE_SIZE';
    return res.status(tooLarge ? 413 : 400).json({
      success: false,
      error: {
        code: error.code.toLowerCase(),
        message: tooLarge ? 'Arquivo excede o limite permitido.' : 'Não foi possível processar o arquivo enviado.'
      },
      message: tooLarge ? 'Arquivo excede o limite permitido.' : 'Não foi possível processar o arquivo enviado.'
    });
  }

  if (error instanceof SyntaxError && error.status === 400 && 'body' in error) {
    return res.status(400).json({
      success: false,
      error: { code: 'invalid_json', message: 'JSON inválido no corpo da requisição.' },
      message: 'JSON inválido no corpo da requisição.'
    });
  }

  const status = Number.isInteger(error.status) && error.status >= 400 && error.status < 600
    ? error.status
    : 500;
  const message = status === 500 ? 'Erro interno no servidor.' : error.message;
  if (status === 500) console.error('Erro não tratado na API:', error);

  return res.status(status).json({
    success: false,
    error: {
      code: error.code || 'internal_error',
      message
    },
    message
  });
}

module.exports = { errorHandler };
