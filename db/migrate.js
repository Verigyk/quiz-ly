// Met à jour une base existante sans perdre de données : npm run migrate
// Peut être relancé sans risque : chaque étape vérifie si elle a déjà été faite.
const pool = require("./pool");

async function columnExists(client, table, column) {
	const { rowCount } = await client.query(
		"SELECT 1 FROM information_schema.columns WHERE table_name = $1 AND column_name = $2",
		[table, column]
	);
	return rowCount > 0;
}

async function main() {
	const client = await pool.connect();
	try {
		await client.query("BEGIN");

		// Rôles : élève ou enseignant (admin)
		await client.query(`
			ALTER TABLE users ADD COLUMN IF NOT EXISTS role TEXT NOT NULL DEFAULT 'student' CHECK (role IN ('student', 'admin'));
			ALTER TABLE users ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
		`);

		// Quiz générés : configuration du générateur (NULL pour un quiz écrit à la main)
		await client.query(`
			ALTER TABLE quizzes ADD COLUMN IF NOT EXISTS config JSONB;
			ALTER TABLE quizzes ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
		`);

		// Les résultats gardent le titre du quiz : supprimer un quiz ne supprime plus l'historique des élèves
		if (!(await columnExists(client, "quiz_results", "title"))) {
			await client.query(`
				ALTER TABLE quiz_results ADD COLUMN title TEXT;
				UPDATE quiz_results r SET title = q.title FROM quizzes q WHERE q.id = r.quiz_id;
				ALTER TABLE quiz_results ALTER COLUMN title SET NOT NULL;
				ALTER TABLE quiz_results ALTER COLUMN quiz_id DROP NOT NULL;
				ALTER TABLE quiz_results DROP CONSTRAINT IF EXISTS quiz_results_quiz_id_fkey;
				ALTER TABLE quiz_results ADD CONSTRAINT quiz_results_quiz_id_fkey
					FOREIGN KEY (quiz_id) REFERENCES quizzes(id) ON DELETE SET NULL;
			`);
		}

		// Les réponses gardent une copie de la question : indispensable pour les questions générées
		if (await columnExists(client, "quiz_answers", "question_id")) {
			await client.query(`
				ALTER TABLE quiz_answers ADD COLUMN position INTEGER;
				ALTER TABLE quiz_answers ADD COLUMN text TEXT;
				ALTER TABLE quiz_answers ADD COLUMN choices TEXT[];
				ALTER TABLE quiz_answers ADD COLUMN answer INTEGER;
				UPDATE quiz_answers a
					SET position = q.position, text = q.text, choices = q.choices, answer = q.answer
					FROM questions q WHERE q.id = a.question_id;
				ALTER TABLE quiz_answers DROP CONSTRAINT IF EXISTS quiz_answers_pkey;
				ALTER TABLE quiz_answers DROP COLUMN question_id;
				ALTER TABLE quiz_answers ALTER COLUMN position SET NOT NULL;
				ALTER TABLE quiz_answers ALTER COLUMN text SET NOT NULL;
				ALTER TABLE quiz_answers ALTER COLUMN choices SET NOT NULL;
				ALTER TABLE quiz_answers ALTER COLUMN answer SET NOT NULL;
				ALTER TABLE quiz_answers ADD PRIMARY KEY (result_id, position);
			`);
		}

		await client.query(`
			-- Quiz du jour choisi par l'enseignant pour tous les élèves (un par date)
			CREATE TABLE IF NOT EXISTS daily_quizzes (
				day DATE PRIMARY KEY,
				quiz_id INTEGER NOT NULL REFERENCES quizzes(id) ON DELETE CASCADE
			);
		`);

		await client.query(`
			-- Quiz du jour particulier d'un élève (remplace celui de la classe) ; quiz_id NULL = pas de quiz ce jour-là
			-- Si le quiz est supprimé, l'élève revient au quiz de la classe
			CREATE TABLE IF NOT EXISTS daily_student_quizzes (
				day DATE NOT NULL,
				username TEXT NOT NULL REFERENCES users(username) ON DELETE CASCADE,
				quiz_id INTEGER REFERENCES quizzes(id) ON DELETE CASCADE,
				PRIMARY KEY (day, username)
			);
		`);

		// Points gagnés (solde de l'élève, et points rapportés par chaque quiz)
		await client.query(`
			ALTER TABLE users ADD COLUMN IF NOT EXISTS points INTEGER NOT NULL DEFAULT 0;
			ALTER TABLE quiz_results ADD COLUMN IF NOT EXISTS points INTEGER NOT NULL DEFAULT 0;
		`);

		await client.query(`
			-- Compagnon de l'élève : bonheur de 0 à 100, tenue portée ({ emplacement: objet })
			CREATE TABLE IF NOT EXISTS companions (
				username TEXT PRIMARY KEY REFERENCES users(username) ON DELETE CASCADE,
				name TEXT NOT NULL DEFAULT 'Nino',
				happiness INTEGER NOT NULL DEFAULT 60,
				last_seen TIMESTAMPTZ NOT NULL DEFAULT NOW(),
				visible BOOLEAN NOT NULL DEFAULT TRUE,
				gifts INTEGER NOT NULL DEFAULT 0,
				equipped JSONB NOT NULL DEFAULT '{}'
			);
			
			-- Tenues achetées dans la boutique
			CREATE TABLE IF NOT EXISTS owned_items (
				username TEXT NOT NULL REFERENCES users(username) ON DELETE CASCADE,
				item_id TEXT NOT NULL,
				bought_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
				PRIMARY KEY (username, item_id)
			);
		`);

		await client.query("COMMIT");
		console.log("Base de données à jour.");
	} catch (error) {
		await client.query("ROLLBACK");
		throw error;
	} finally {
		client.release();
		await pool.end();
	}
}

main().catch((error) => {
	console.error(error.message);
	process.exit(1);
});
