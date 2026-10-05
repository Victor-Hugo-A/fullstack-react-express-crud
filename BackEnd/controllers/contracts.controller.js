const mime = require('mime-types');

function asyncHandler(handler) {
  return (req, res, next) => Promise.resolve(handler(req, res, next)).catch(next);
}

function createContractsController(service) {
  return {
    list: asyncHandler(async (req, res) => {
      const contracts = await service.list({
        type: req.query.type,
        year: req.query.year,
        search: req.query.search
      });
      res.json(contracts);
    }),

    count: asyncHandler(async (req, res) => {
      const count = await service.count(req.query.year);
      res.json({ count });
    }),

    groupByType: asyncHandler(async (req, res) => {
      res.json(await service.countByType());
    }),

    check: asyncHandler(async (req, res) => {
      res.json({ exists: await service.checkNumber(req.query.number) });
    }),

    create: asyncHandler(async (req, res) => {
      const contract = await service.create(req.body, req.file);
      res.status(201).json(contract);
    }),

    update: asyncHandler(async (req, res) => {
      const contract = await service.update(req.params.id, req.body, req.file);
      res.json({ success: true, contract });
    }),

    get: asyncHandler(async (req, res) => {
      res.json(service.toPublic(await service.find(req.params.id)));
    }),

    download: asyncHandler(async (req, res, next) => {
      const { contract, filePath } = await service.resolveFile(req.params.id);
      const contentType = mime.lookup(contract.originalName) || 'application/octet-stream';
      const filename = encodeURIComponent(contract.originalName);
      res.set({
        'Content-Type': contentType,
        'Content-Disposition': `attachment; filename="${filename}"; filename*=UTF-8''${filename}`,
        'Cache-Control': 'no-store',
        'Accept-Ranges': 'bytes'
      });
      const stream = require('node:fs').createReadStream(filePath);
      stream.on('error', next);
      stream.pipe(res);
    }),

    view: asyncHandler(async (req, res, next) => {
      const { contract, filePath } = await service.resolveFile(req.params.id);
      const contentType = contract.mimeType || mime.lookup(contract.originalName) || 'application/octet-stream';
      const inline = contentType === 'application/pdf' || contentType.startsWith('image/');
      res.set({
        'Content-Type': contentType,
        'Content-Disposition': `${inline ? 'inline' : 'attachment'}; filename="${encodeURIComponent(contract.originalName)}"`,
        'X-Content-Type-Options': 'nosniff',
        'Cache-Control': 'no-store'
      });
      const stream = require('node:fs').createReadStream(filePath, { highWaterMark: 64 * 1024 });
      stream.on('error', next);
      stream.pipe(res);
    }),

    delete: asyncHandler(async (req, res) => {
      await service.delete(req.params.id);
      res.json({ success: true });
    }),

    cleanAll: asyncHandler(async (req, res) => {
      await service.clear();
      res.json({
        success: true,
        message: 'Todos os contratos e arquivos foram removidos com sucesso',
        contracts: []
      });
    }),

    sync: asyncHandler(async (req, res) => {
      res.json({ success: true, count: await service.sync() });
    })
  };
}

module.exports = { createContractsController, asyncHandler };
