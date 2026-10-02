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

		// Chaque élève appartient à un seul professeur. Au premier passage, s'il n'y a qu'un
		// professeur, il récupère tous les élèves existants ; sinon ils restent « sans professeur ».
		if (!(await columnExists(client, "users", "teacher"))) {
			await client.query(`
				ALTER TABLE users ADD COLUMN teacher TEXT REFERENCES users(username) ON DELETE SET NULL ON UPDATE CASCADE;
				UPDATE users SET teacher = (SELECT username FROM users WHERE role = 'admin')
					WHERE role = 'student' AND (SELECT COUNT(*) FROM users WHERE role = 'admin') = 1;
			`);
		}

		// Quiz : propriétaire et accès restreint à certains élèves et professeurs.
		// Les quiz existants restent communs (sans propriétaire) et visibles par tous.
		await client.query(`
			ALTER TABLE quizzes ADD COLUMN IF NOT EXISTS owner TEXT REFERENCES users(username) ON DELETE SET NULL ON UPDATE CASCADE;
			ALTER TABLE quizzes ADD COLUMN IF NOT EXISTS restricted BOOLEAN NOT NULL DEFAULT FALSE;
			CREATE TABLE IF NOT EXISTS quiz_access (
				quiz_id INTEGER NOT NULL REFERENCES quizzes(id) ON DELETE CASCADE,
				username TEXT NOT NULL REFERENCES users(username) ON DELETE CASCADE ON UPDATE CASCADE,
				PRIMARY KEY (quiz_id, username)
			);
		`);

		// Quiz du jour : un planning par professeur. Le planning commun existant est copié pour chaque professeur.
		if (!(await columnExists(client, "daily_quizzes", "teacher"))) {
			await client.query(`
				ALTER TABLE daily_quizzes DROP CONSTRAINT IF EXISTS daily_quizzes_pkey;
				ALTER TABLE daily_quizzes ADD COLUMN teacher TEXT REFERENCES users(username) ON DELETE CASCADE ON UPDATE CASCADE;
				INSERT INTO daily_quizzes (day, teacher, quiz_id)
					SELECT d.day, u.username, d.quiz_id FROM daily_quizzes d CROSS JOIN users u
					WHERE d.teacher IS NULL AND u.role = 'admin';
				DELETE FROM daily_quizzes WHERE teacher IS NULL;
				ALTER TABLE daily_quizzes ALTER COLUMN teacher SET NOT NULL;
				ALTER TABLE daily_quizzes ADD PRIMARY KEY (day, teacher);
			`);
		}

		// Quiz privés : visibles seulement par leur créateur et les élèves choisis.
		// Les quiz qui étaient ouverts à tous restent accessibles à tous les élèves existants
		// (le professeur peut ensuite décocher), et les accès donnés à des professeurs sont retirés.
		if (await columnExists(client, "quizzes", "restricted")) {
			await client.query(`
				INSERT INTO quiz_access (quiz_id, username)
					SELECT q.id, u.username FROM quizzes q CROSS JOIN users u
					WHERE NOT q.restricted AND u.role = 'student'
					ON CONFLICT DO NOTHING;
				DELETE FROM quiz_access a USING users u WHERE u.username = a.username AND u.role = 'admin';
				ALTER TABLE quizzes DROP COLUMN restricted;
			`);
		}

		await client.query(`
			-- Catégories personnelles d'un professeur (ex. « Mes identités remarquables »)
			CREATE TABLE IF NOT EXISTS categories (
				id SERIAL PRIMARY KEY,
				owner TEXT NOT NULL REFERENCES users(username) ON DELETE CASCADE ON UPDATE CASCADE,
				name TEXT NOT NULL,
				UNIQUE (owner, name)
			);
			
			-- Modèles de questions : variables tirées au hasard, énoncé, bonne réponse et pièges (voir generators/custom.js)
			CREATE TABLE IF NOT EXISTS templates (
				id SERIAL PRIMARY KEY,
				owner TEXT NOT NULL REFERENCES users(username) ON DELETE CASCADE ON UPDATE CASCADE,
				category_id INTEGER NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
				definition JSONB NOT NULL,
				created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
			);
		`);

		// Plusieurs professeurs par élève : l'ancien professeur unique (users.teacher) devient un lien,
		// et les choix de quiz du jour par élève sont rattachés à ce professeur.
		await client.query(`
			-- Liens professeur ↔ élève : un élève peut avoir plusieurs professeurs
			CREATE TABLE IF NOT EXISTS teacher_students (
				teacher TEXT NOT NULL REFERENCES users(username) ON DELETE CASCADE ON UPDATE CASCADE,
				student TEXT NOT NULL REFERENCES users(username) ON DELETE CASCADE ON UPDATE CASCADE,
				joined_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
				PRIMARY KEY (teacher, student)
			);
			ALTER TABLE users ADD COLUMN IF NOT EXISTS link_code TEXT UNIQUE;
			ALTER TABLE users ADD COLUMN IF NOT EXISTS link_code_expires TIMESTAMPTZ;
			-- Codes créés avant l'usage unique (sans date d'expiration) : ils ne sont plus valables
			UPDATE users SET link_code = NULL WHERE link_code IS NOT NULL AND link_code_expires IS NULL;
		`);
		if (await columnExists(client, "users", "teacher")) {
			await client.query(`
				INSERT INTO teacher_students (teacher, student)
					SELECT teacher, username FROM users WHERE teacher IS NOT NULL
					ON CONFLICT DO NOTHING;
				ALTER TABLE daily_student_quizzes ADD COLUMN IF NOT EXISTS teacher TEXT REFERENCES users(username) ON DELETE CASCADE ON UPDATE CASCADE;
				UPDATE daily_student_quizzes s SET teacher = u.teacher FROM users u WHERE u.username = s.username AND s.teacher IS NULL;
				DELETE FROM daily_student_quizzes WHERE teacher IS NULL;
				ALTER TABLE daily_student_quizzes ALTER COLUMN teacher SET NOT NULL;
				ALTER TABLE daily_student_quizzes DROP CONSTRAINT IF EXISTS daily_student_quizzes_pkey;
				ALTER TABLE daily_student_quizzes ADD PRIMARY KEY (day, teacher, username);
				ALTER TABLE users DROP COLUMN teacher;
			`);
		}

		// Le compagnon est triste quand l'élève oublie le quiz du jour. Les jours passés ne sont pas
		// comptés rétroactivement : la vérification commence à hier pour les compagnons existants.
		await client.query(`
			ALTER TABLE companions ADD COLUMN IF NOT EXISTS checked_until DATE NOT NULL DEFAULT (CURRENT_DATE - 1);
			ALTER TABLE companions ADD COLUMN IF NOT EXISTS missed_quizzes INTEGER NOT NULL DEFAULT 0;
			ALTER TABLE companions ADD COLUMN IF NOT EXISTS missed_on DATE;
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
