const mongoRepo = require('./articleRepository.mongo');
const sqlRepo = require('./articleRepository.sql');

const useSql = process.env.DB_ENGINE === 'sql';

module.exports = useSql ? sqlRepo : mongoRepo;


