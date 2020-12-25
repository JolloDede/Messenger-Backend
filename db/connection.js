const monk = require('monk');

const db = monk('localhost/Messenger');

module.exports = db;