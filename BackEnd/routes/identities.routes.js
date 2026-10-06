const express = require('express');
const { createIdentitiesController } = require('../controllers/identities.controller');

function createIdentitiesRouter({ authenticateJWT, requireAdmin, requirePermission, upload, validateUploadedFiles, service }) {
  const router = express.Router();
  const controller = createIdentitiesController(service);

  router.get('/identities/groupby/perfil', authenticateJWT, controller.groupByPerfil);
  router.get('/identities/count', authenticateJWT, controller.count);
  router.post('/identities', authenticateJWT, requirePermission('identities:write'), upload.single('foto'), validateUploadedFiles('identity'), controller.create);
  router.get('/identities', authenticateJWT, controller.list);
  router.delete('/identities/:id', authenticateJWT, requireAdmin, controller.delete);

  return router;
}

module.exports = { createIdentitiesRouter };
