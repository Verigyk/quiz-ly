// Crée les tables et insère les données de départ : npm run populate
const bcrypt = require("bcrypt");
const pool = require("./pool");

const SCHEMA = require("./schema");

// Supprime tout, recrée les tables et ajoute des données de test (à utiliser en local uniquement)
const SQL = `
DROP TABLE IF EXISTS templates, categories, quiz_access, teacher_students, owned_items, companions, daily_student_quizzes, daily_quizzes, quiz_answers, quiz_results, questions, quizzes, users;

${SCHEMA}

INSERT INTO quizzes (id, title) VALUES (1, 'Géographie'), (2, 'Sciences');
SELECT setval('quizzes_id_seq', (SELECT MAX(id) FROM quizzes));

INSERT INTO questions (quiz_id, position, text, choices, answer) VALUES
	(1, 0, 'Quelle est la capitale de la France ?', ARRAY['Paris', 'Lyon', 'Marseille'], 0),
	(1, 1, 'Quel est le plus long fleuve de France ?', ARRAY['La Seine', 'La Loire', 'Le Rhône'], 1),
	(1, 2, 'Quel océan borde la côte ouest de la France ?', ARRAY['Pacifique', 'Indien', 'Atlantique'], 2),
	(2, 0, 'Quelle est la formule chimique de l''eau ?', ARRAY['H2O', 'CO2', 'O2'], 0),
	(2, 1, 'Combien de planètes compte le système solaire ?', ARRAY['7', '8', '9'], 1);
`;

async function main() {
	// Sécurité : ce script efface tout. Il ne tourne que sur une base locale (fichier .env),
	// jamais en ligne ni avec DATABASE_URL (Railway, Neon…).
	if (process.env.DATABASE_URL || process.env.NODE_ENV === "production" || process.env.RAILWAY_ENVIRONMENT) {
		throw new Error("populate efface toutes les données : il est bloqué sur la base en ligne. Rien n'a été modifié.");
	}

	console.log("Création des tables...");
	await pool.query(SQL);

	// Les mots de passe ne sont jamais stockés en clair, seulement leur hash bcrypt
	const passwordHash = await bcrypt.hash("Gregory", 10);
	await pool.query("INSERT INTO users (username, password_hash) VALUES ($1, $2)", ["Gregory", passwordHash]);
	await pool.end();
	console.log("Terminé.");
}

main().catch((error) => {
	console.error(error.message);
	process.exit(1);
});
