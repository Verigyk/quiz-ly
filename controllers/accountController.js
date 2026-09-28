const db = require("../db");

// Renvoie { username, role } si la connexion réussit
async function authentification(username, password) {
	return db.authentification(username, password);
}

module.exports = {
	authentification
}
