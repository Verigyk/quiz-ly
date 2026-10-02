// Prépare la base avant le démarrage du site : npm run setup
// - base vide (premier déploiement) : crée toutes les tables, sans données de test ;
// - base existante : applique les mises à jour de db/migrate.js, sans rien supprimer.
// Peut être lancé à chaque déploiement.
const pool = require("./pool");
const SCHEMA = require("./schema");

async function main() {
	// Dates calculées à l'heure française dans la base (quiz du jour, limite de points par jour).
	// Réglé sur la base elle-même : chaque nouvelle connexion en hérite.
	await pool.query(`
		DO $$ BEGIN
			EXECUTE format('ALTER DATABASE %I SET timezone TO %L', current_database(), '${pool.timezone.replace(/'/g, "")}');
		END $$;
	`);

	const { rows } = await pool.query("SELECT to_regclass('public.users') IS NOT NULL AS exists");

	if (rows[0].exists) {
		console.log("Base existante : application des mises à jour…");
		// migrate.js se lance tout seul et ferme la connexion à la fin
		require("./migrate");
		return;
	}

	console.log("Base vide : création des tables…");
	await pool.query(SCHEMA);
	await pool.end();
	console.log("Tables créées. Créez votre compte professeur avec : npm run create-admin -- <identifiant> <mot de passe>");
}

main().catch((error) => {
	console.error(error.message);
	process.exit(1);
});
