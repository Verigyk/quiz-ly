// Crée les tables et insère les données de départ : npm run populate
const bcrypt = require("bcrypt");
const pool = require("./pool");

const SQL = `
DROP TABLE IF EXISTS owned_items, companions, daily_student_quizzes, daily_quizzes, quiz_answers, quiz_results, questions, quizzes, users;

CREATE TABLE users (
	username TEXT PRIMARY KEY,
	password_hash TEXT NOT NULL,
	role TEXT NOT NULL DEFAULT 'student' CHECK (role IN ('student', 'admin')),
	points INTEGER NOT NULL DEFAULT 0,
	created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE quizzes (
	id SERIAL PRIMARY KEY,
	title TEXT NOT NULL,
	-- Configuration du générateur de questions (NULL pour un quiz écrit à la main)
	config JSONB,
	created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Quiz du jour choisi par l'enseignant pour tous les élèves (un par date)
CREATE TABLE daily_quizzes (
	day DATE PRIMARY KEY,
	quiz_id INTEGER NOT NULL REFERENCES quizzes(id) ON DELETE CASCADE
);

-- Quiz du jour particulier d'un élève (remplace celui de la classe) ; quiz_id NULL = pas de quiz ce jour-là
-- Si le quiz est supprimé, l'élève revient au quiz de la classe
CREATE TABLE daily_student_quizzes (
	day DATE NOT NULL,
	username TEXT NOT NULL REFERENCES users(username) ON DELETE CASCADE,
	quiz_id INTEGER REFERENCES quizzes(id) ON DELETE CASCADE,
	PRIMARY KEY (day, username)
);

-- Compagnon de l'élève : bonheur de 0 à 100, tenue portée ({ emplacement: objet })
CREATE TABLE companions (
	username TEXT PRIMARY KEY REFERENCES users(username) ON DELETE CASCADE,
	name TEXT NOT NULL DEFAULT 'Nino',
	happiness INTEGER NOT NULL DEFAULT 60,
	last_seen TIMESTAMPTZ NOT NULL DEFAULT NOW(),
	visible BOOLEAN NOT NULL DEFAULT TRUE,
	gifts INTEGER NOT NULL DEFAULT 0,
	equipped JSONB NOT NULL DEFAULT '{}'
);

-- Tenues achetées dans la boutique
CREATE TABLE owned_items (
	username TEXT NOT NULL REFERENCES users(username) ON DELETE CASCADE,
	item_id TEXT NOT NULL,
	bought_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
	PRIMARY KEY (username, item_id)
);

-- answer = index (à partir de 0) de la bonne réponse dans choices
CREATE TABLE questions (
	id SERIAL PRIMARY KEY,
	quiz_id INTEGER NOT NULL REFERENCES quizzes(id) ON DELETE CASCADE,
	position INTEGER NOT NULL,
	text TEXT NOT NULL,
	choices TEXT[] NOT NULL,
	answer INTEGER NOT NULL,
	UNIQUE (quiz_id, position)
);

-- Un résultat enregistré à chaque quiz terminé, ou abandonné via « Recommencer » (completed = false)
CREATE TABLE quiz_results (
	id SERIAL PRIMARY KEY,
	username TEXT NOT NULL REFERENCES users(username) ON DELETE CASCADE,
	-- Le titre est copié : supprimer un quiz ne supprime pas l'historique des élèves
	quiz_id INTEGER REFERENCES quizzes(id) ON DELETE SET NULL,
	title TEXT NOT NULL,
	score INTEGER NOT NULL,
	total INTEGER NOT NULL,
	completed BOOLEAN NOT NULL DEFAULT TRUE,
	points INTEGER NOT NULL DEFAULT 0,
	completed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Copie de chaque question posée et réponse choisie (chosen = index dans choices, -1 si aucune)
CREATE TABLE quiz_answers (
	result_id INTEGER NOT NULL REFERENCES quiz_results(id) ON DELETE CASCADE,
	position INTEGER NOT NULL,
	text TEXT NOT NULL,
	choices TEXT[] NOT NULL,
	answer INTEGER NOT NULL,
	chosen INTEGER NOT NULL,
	PRIMARY KEY (result_id, position)
);

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
