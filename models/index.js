const fs = require('fs'),
    path = require('path'),
    Sequelize = require('sequelize');

if (!process.env.DATABASE_URL) {
    console.error('Error: DATABASE_URL is required');
    process.exit(1);
}

const sequelize = new Sequelize(process.env.DATABASE_URL);

let db = {};

fs.readdirSync(__dirname)
    .filter(file => {
        return (file.indexOf(".") !== 0 && (file !== "index.js"));
    })
    .forEach(file => {
        let model = sequelize.import(path.join(__dirname, file));
        db[model.name] = model;
    });

Object.keys(db).forEach(model => {
    if ("associate" in db[model]) {
        db[model].associate(db);
    }
});

db.sequelize = sequelize;
db.Sequelize = Sequelize;

module.exports = db;
