const express = require('express');
const { createProjectsController } = require('../controllers/projects.controller');

function createProjectsRouter({ authenticateJWT, requireAdmin, requirePermission, upload, validateUploadedFiles, service }) {
  const router = express.Router();
  const controller = createProjectsController(service);

  router.get('/projects/groupby/status', authenticateJWT, controller.groupByStatus);
  router.get('/projects/count', authenticateJWT, controller.count);
  router.post('/projects', authenticateJWT, requirePermission('projects:write'), upload.array('files'), validateUploadedFiles('project'), controller.create);
  router.get('/projects', authenticateJWT, controller.list);
  router.get('/projects/:id', authenticateJWT, controller.get);
  router.get('/project-files/:filename', authenticateJWT, controller.getFile);
  router.delete('/project-files/:id', authenticateJWT, requireAdmin, controller.deleteFile);
  router.put('/projects/:id', authenticateJWT, requirePermission('projects:write'), upload.array('files'), validateUploadedFiles('project'), controller.update);
  router.delete('/projects/:id', authenticateJWT, requireAdmin, controller.delete);

  return router;
}

module.exports = { createProjectsRouter };
