const path = require("node:path");
const { Pool } = require("pg");

// Charge le .env à la racine du projet, quelle que soit la façon de lancer le site
try {
	process.loadEnvFile(path.join(__dirname, "..", ".env"));
} catch {
	console.warn("Fichier .env introuvable : paramètres PostgreSQL par défaut utilisés.");
}

// Les paramètres de connexion viennent du fichier .env (PGHOST, PGPORT, PGDATABASE, PGUSER, PGPASSWORD)
module.exports = new Pool({
	host: process.env.PGHOST || "localhost",
	port: Number(process.env.PGPORT) || 5432,
	database: process.env.PGDATABASE || "postgres",
	user: process.env.PGUSER || "postgres",
	password: process.env.PGPASSWORD
});
