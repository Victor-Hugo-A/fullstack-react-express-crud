const path = require('node:path');

process.chdir(path.resolve(__dirname, '..', 'BackEnd'));
require('../BackEnd/server.js');
