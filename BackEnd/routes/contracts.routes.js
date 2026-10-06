const express = require('express');
const { createContractsController } = require('../controllers/contracts.controller');
const { validate } = require('../middlewares/validate');

function createContractsRouter({ authenticateJWT, requireAdmin, requirePermission, upload, validateUploadedFiles, service }) {
  const router = express.Router();
  const controller = createContractsController(service);
  const contractId = req => {
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(req.params.id)) {
      const error = new Error('ID do contrato inválido.');
      error.status = 400;
      error.code = 'invalid_contract_id';
      throw error;
    }
  };
  const validYear = req => {
    if (req.query.year !== undefined && (typeof req.query.year !== 'string' || !/^\d{4}$/.test(req.query.year))) {
      const error = new Error('Ano inválido. Informe quatro dígitos.');
      error.status = 400;
      error.code = 'invalid_year';
      throw error;
    }
  };
  router.get('/contracts/count', authenticateJWT, validate(validYear), controller.count);
  router.get('/contracts/groupby/type', authenticateJWT, controller.groupByType);
  router.get('/contracts/check', authenticateJWT, controller.check);
  router.post('/contracts/sync', authenticateJWT, requireAdmin, controller.sync);
  router.delete('/contracts/clean-all', authenticateJWT, requireAdmin, controller.cleanAll);
  router.get('/contracts', authenticateJWT, validate(validYear), controller.list);
  router.post('/contracts', authenticateJWT, requirePermission('contracts:write'), upload.single('file'), validateUploadedFiles('contract'), controller.create);
  router.put('/contracts/:id', authenticateJWT, requirePermission('contracts:write'), validate(contractId), upload.single('file'), validateUploadedFiles('contract'), controller.update);
  router.get('/contracts/:id/download', authenticateJWT, validate(contractId), controller.download);
  router.get('/contracts/:id/view', authenticateJWT, validate(contractId), controller.view);
  router.get('/contracts/:id', authenticateJWT, validate(contractId), controller.get);
  router.delete('/contracts/:id', authenticateJWT, requireAdmin, validate(contractId), controller.delete);

  return router;
}

module.exports = { createContractsRouter };
