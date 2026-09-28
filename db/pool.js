const path = require("node:path");
const { Pool } = require("pg");

// En local : charge le .env à la racine du projet (sur Railway, les variables sont fournies par la plateforme)
try {
	process.loadEnvFile(path.join(__dirname, "..", ".env"));
} catch {
	// Pas de .env : on utilise les variables d'environnement déjà définies
}

// Les dates (quiz du jour, limite de points par jour) sont calculées à l'heure française,
// même si le serveur ou la base sont réglés sur UTC
const TIMEZONE = process.env.TZ || "Europe/Paris";
process.env.TZ = TIMEZONE;

// Connexion :
// - DATABASE_URL (Railway) : postgresql://utilisateur:motdepasse@hôte:port/base
// - sinon PGHOST, PGPORT, PGDATABASE, PGUSER, PGPASSWORD (fichier .env en local)
// PGSSL=true active le chiffrement, utile avec l'adresse publique de Railway.
const config = process.env.DATABASE_URL
	? { connectionString: process.env.DATABASE_URL }
	: {
		host: process.env.PGHOST || "localhost",
		port: Number(process.env.PGPORT) || 5432,
		database: process.env.PGDATABASE || "postgres",
		user: process.env.PGUSER || "postgres",
		password: process.env.PGPASSWORD
	};

module.exports = new Pool({
	...config,
	ssl: process.env.PGSSL === "true" ? { rejectUnauthorized: false } : undefined,
	options: `-c timezone=${TIMEZONE}`
});
