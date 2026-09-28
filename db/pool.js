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
// - DATABASE_URL (Railway) : postgresql://utilisateur:motdepasse@hôte:5432/base
// - sinon PGHOST, PGPORT, PGDATABASE, PGUSER, PGPASSWORD (fichier .env en local)
let target;
try {
	target = process.env.DATABASE_URL ? new URL(process.env.DATABASE_URL) : null;
} catch {
	throw new Error("DATABASE_URL n'est pas une adresse valide. Elle doit commencer par postgresql://");
}

// Le PostgreSQL de Railway (image postgres-ssl) accepte SSL avec un certificat auto-signé.
// - réseau privé (*.railway.internal) : pas besoin de SSL ;
// - adresse publique (*.rlwy.net) ou ?sslmode=… dans l'URL : SSL activé, sans vérifier le certificat
//   (avec « sslmode=require », la bibliothèque pg refuserait le certificat auto-signé).
// PGSSL=true / PGSSL=false force le choix.
const sslMode = target ? target.searchParams.get("sslmode") : null;
if (target) {
	target.searchParams.delete("sslmode");
}
const config = target
	? { connectionString: target.toString() }
	: {
		host: process.env.PGHOST || "localhost",
		port: Number(process.env.PGPORT) || 5432,
		database: process.env.PGDATABASE || "postgres",
		user: process.env.PGUSER || "postgres",
		password: process.env.PGPASSWORD
	};
const host = target ? target.hostname : config.host;
const useSsl = process.env.PGSSL
	? process.env.PGSSL === "true"
	: (sslMode !== null && sslMode !== "disable") || /\.rlwy\.net$/.test(host);

// Indique où le site se connecte, sans afficher le mot de passe
console.log(`PostgreSQL : ${target ? `${host}:${target.port || 5432}${target.pathname}` : `${host}:${config.port}/${config.database}`}${useSsl ? " (SSL)" : ""}`);

// En ligne (Railway définit toujours RAILWAY_ENVIRONMENT), aucune base ne tourne sur « localhost »
const online = Boolean(process.env.RAILWAY_ENVIRONMENT) || process.env.NODE_ENV === "production";
if (online && ["localhost", "127.0.0.1", "::1"].includes(host)) {
	throw new Error(
		(target ? "DATABASE_URL pointe vers localhost. " : "DATABASE_URL n'est pas définie pour ce service. ") +
		"Sur Railway, dans les variables du service du SITE (pas celui de PostgreSQL), ajoutez : " +
		"DATABASE_URL = ${{Postgres.DATABASE_URL}} via « Add Reference », puis redéployez."
	);
}

module.exports = new Pool({
	...config,
	ssl: useSsl ? { rejectUnauthorized: false } : undefined,
	options: `-c timezone=${TIMEZONE}`
});
