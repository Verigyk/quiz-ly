const bcrypt = require("bcrypt");
const pool = require("./db/pool");

// ---------- Comptes ----------

async function userExist(username) {
	const { rowCount } = await pool.query("SELECT 1 FROM users WHERE username = $1", [username]);
	return rowCount > 0;
}

// Renvoie { username, role } si l'identifiant et le mot de passe sont bons
async function authentification(username, password) {
	const { rows } = await pool.query("SELECT username, role, password_hash FROM users WHERE username = $1", [username]);
	if (rows.length === 0) {
		throw new Error("User does not exist.");
	}
	if (!(await bcrypt.compare(password, rows[0].password_hash))) {
		throw new Error("Wrong password.");
	}
	return { username: rows[0].username, role: rows[0].role };
}

// Élèves avec leurs statistiques (quiz terminés uniquement pour la moyenne)
async function getStudents() {
	const { rows } = await pool.query(`
		SELECT u.username, u.created_at, u.points,
			COUNT(r.id)::int AS attempts,
			COUNT(r.id) FILTER (WHERE r.completed)::int AS completed,
			ROUND(AVG(100.0 * r.score / NULLIF(r.total, 0)) FILTER (WHERE r.completed))::int AS average,
			MAX(r.completed_at) AS last_activity
		FROM users u
		LEFT JOIN quiz_results r ON r.username = u.username
		WHERE u.role = 'student'
		GROUP BY u.username
		ORDER BY u.username
	`);
	return rows;
}

async function isStudent(username) {
	const { rowCount } = await pool.query("SELECT 1 FROM users WHERE username = $1 AND role = 'student'", [username]);
	return rowCount > 0;
}

async function createStudent(username, password) {
	const hash = await bcrypt.hash(password, 10);
	await pool.query("INSERT INTO users (username, password_hash, role) VALUES ($1, $2, 'student')", [username, hash]);
}

async function setStudentPassword(username, password) {
	const hash = await bcrypt.hash(password, 10);
	await pool.query("UPDATE users SET password_hash = $2 WHERE username = $1 AND role = 'student'", [username, hash]);
}

// Supprime l'élève et tout son historique
async function deleteStudent(username) {
	await pool.query("DELETE FROM users WHERE username = $1 AND role = 'student'", [username]);
}

// ---------- Quiz ----------

// Nombre de questions : fixé par la configuration si les questions sont régénérées à chaque tentative
function questionCount(quiz, storedCount) {
	return quiz.config && quiz.config.regenerate ? quiz.config.questionCount : storedCount;
}

async function getQuizzes() {
	const { rows } = await pool.query(`
		SELECT q.id, q.title, q.config, q.created_at, COUNT(qu.id)::int AS stored
		FROM quizzes q
		LEFT JOIN questions qu ON qu.quiz_id = q.id
		GROUP BY q.id
		ORDER BY q.id
	`);
	return rows.map((q) => ({
		id: q.id,
		title: q.title,
		config: q.config,
		description: q.config ? q.config.description : "",
		generated: Boolean(q.config),
		count: questionCount(q, q.stored),
		created_at: q.created_at
	}));
}

// Renvoie le quiz avec ses questions enregistrées (vide si elles sont régénérées), ou undefined
async function getQuiz(id) {
	const quizResult = await pool.query("SELECT id, title, config FROM quizzes WHERE id = $1", [id]);
	const quiz = quizResult.rows[0];
	if (!quiz) {
		return undefined;
	}

	const questionsResult = await pool.query(
		"SELECT text, choices, answer FROM questions WHERE quiz_id = $1 ORDER BY position",
		[id]
	);
	quiz.questions = questionsResult.rows;
	return quiz;
}

async function insertQuestions(client, quizId, questions) {
	for (const [position, q] of questions.entries()) {
		await client.query(
			"INSERT INTO questions (quiz_id, position, text, choices, answer) VALUES ($1, $2, $3, $4, $5)",
			[quizId, position, q.text, q.choices, q.answer]
		);
	}
}

async function transaction(work) {
	const client = await pool.connect();
	try {
		await client.query("BEGIN");
		const result = await work(client);
		await client.query("COMMIT");
		return result;
	} catch (error) {
		await client.query("ROLLBACK");
		throw error;
	} finally {
		client.release();
	}
}

// questions = liste figée, ou null si elles sont régénérées à chaque tentative
async function createQuiz(config, questions) {
	return transaction(async (client) => {
		const { rows } = await client.query(
			"INSERT INTO quizzes (title, config) VALUES ($1, $2) RETURNING id",
			[config.title, config]
		);
		if (questions) {
			await insertQuestions(client, rows[0].id, questions);
		}
		return rows[0].id;
	});
}

async function updateQuiz(id, config, questions) {
	await transaction(async (client) => {
		await client.query("UPDATE quizzes SET title = $2, config = $3 WHERE id = $1", [id, config.title, config]);
		await client.query("DELETE FROM questions WHERE quiz_id = $1", [id]);
		if (questions) {
			await insertQuestions(client, id, questions);
		}
	});
}

// L'historique des élèves est conservé (quiz_id passe à NULL, le titre reste)
async function deleteQuiz(id) {
	await pool.query("DELETE FROM quizzes WHERE id = $1", [id]);
}

// ---------- Résultats ----------

// answers = [{ text, choices, answer, chosen }] : copie des questions réellement posées
async function saveResult(username, quizId, title, score, total, answers, completed = true, points = 0, joy = 0) {
	await transaction(async (client) => {
		const { rows } = await client.query(
			"INSERT INTO quiz_results (username, quiz_id, title, score, total, completed, points) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id",
			[username, quizId, title, score, total, completed, points]
		);
		if (points > 0) {
			await client.query("UPDATE users SET points = points + $2 WHERE username = $1", [username, points]);
		}
		if (joy > 0) {
			await client.query("UPDATE companions SET happiness = LEAST(100, happiness + $2) WHERE username = $1", [username, joy]);
		}
		for (const [position, a] of answers.entries()) {
			await client.query(
				"INSERT INTO quiz_answers (result_id, position, text, choices, answer, chosen) VALUES ($1, $2, $3, $4, $5, $6)",
				[rows[0].id, position, a.text, a.choices, a.answer, a.chosen]
			);
		}
	});
}

const RESULT_COLUMNS = `
	r.id, r.title, r.score, r.total, r.completed, r.completed_at, r.points,
	(SELECT COUNT(*)::int FROM quiz_answers a WHERE a.result_id = r.id) AS answered
`;

// Historique d'un utilisateur, du plus récent au plus ancien
async function getHistory(username) {
	const { rows } = await pool.query(`
		SELECT ${RESULT_COLUMNS}
		FROM quiz_results r
		WHERE r.username = $1
		ORDER BY r.completed_at DESC
	`, [username]);
	return rows;
}

// Détail d'un quiz fait ; undefined s'il n'existe pas ou n'appartient pas à l'utilisateur
async function getResultDetail(resultId, username) {
	const resultQuery = await pool.query(`
		SELECT ${RESULT_COLUMNS}
		FROM quiz_results r
		WHERE r.id = $1 AND r.username = $2
	`, [resultId, username]);
	const result = resultQuery.rows[0];
	if (!result) {
		return undefined;
	}

	const answersQuery = await pool.query(
		"SELECT text, choices, answer, chosen FROM quiz_answers WHERE result_id = $1 ORDER BY position",
		[resultId]
	);
	result.answers = answersQuery.rows;
	return result;
}

// ---------- Quiz du jour ----------
// daily_quizzes : quiz de la classe pour un jour.
// daily_student_quizzes : choix particulier pour un élève ce jour-là (quiz_id NULL = pas de quiz pour lui).

// Planning de 7 jours à partir de start : quiz de la classe, choix par élève et quiz terminés
async function getWeekPlan(start) {
	const range = "BETWEEN $1::date AND $1::date + 6";
	const [defaults, overrides, completions] = await Promise.all([
		pool.query(`SELECT day::text AS day, quiz_id FROM daily_quizzes WHERE day ${range}`, [start]),
		pool.query(`SELECT day::text AS day, username, quiz_id FROM daily_student_quizzes WHERE day ${range}`, [start]),
		pool.query(`
			SELECT DISTINCT completed_at::date::text AS day, username, quiz_id
			FROM quiz_results
			WHERE completed AND quiz_id IS NOT NULL AND completed_at::date ${range}
		`, [start])
	]);
	return { defaults: defaults.rows, overrides: overrides.rows, completions: completions.rows };
}

async function getStudentNames() {
	const { rows } = await pool.query("SELECT username FROM users WHERE role = 'student' ORDER BY username");
	return rows.map((r) => r.username);
}

// defaults = [{ day, quizId | null }]
// overrides = [{ day, username, choice }] avec choice = "classe" (suit la classe), "aucun" ou un id de quiz
async function setDailyPlan(defaults, overrides) {
	await transaction(async (client) => {
		for (const { day, quizId } of defaults) {
			if (quizId === null) {
				await client.query("DELETE FROM daily_quizzes WHERE day = $1", [day]);
			} else {
				await client.query(
					"INSERT INTO daily_quizzes (day, quiz_id) VALUES ($1, $2) ON CONFLICT (day) DO UPDATE SET quiz_id = EXCLUDED.quiz_id",
					[day, quizId]
				);
			}
		}
		for (const { day, username, choice } of overrides) {
			if (choice === "classe") {
				await client.query("DELETE FROM daily_student_quizzes WHERE day = $1 AND username = $2", [day, username]);
			} else {
				await client.query(`
					INSERT INTO daily_student_quizzes (day, username, quiz_id) VALUES ($1, $2, $3)
					ON CONFLICT (day, username) DO UPDATE SET quiz_id = EXCLUDED.quiz_id
				`, [day, username, choice === "aucun" ? null : choice]);
			}
		}
	});
}

// Quiz du jour d'un élève (son choix particulier, sinon celui de la classe),
// avec son meilleur score du jour s'il l'a déjà terminé ; undefined s'il n'en a pas
async function getDailyQuiz(day, username) {
	const { rows } = await pool.query(`
		WITH chosen AS (
			SELECT CASE WHEN s.username IS NOT NULL THEN s.quiz_id ELSE d.quiz_id END AS quiz_id
			FROM (SELECT $1::date AS day) t
			LEFT JOIN daily_student_quizzes s ON s.day = t.day AND s.username = $2
			LEFT JOIN daily_quizzes d ON d.day = t.day
		)
		SELECT q.id, q.title, q.config, best.score, best.total
		FROM chosen
		JOIN quizzes q ON q.id = chosen.quiz_id
		LEFT JOIN LATERAL (
			SELECT r.score, r.total FROM quiz_results r
			WHERE r.username = $2 AND r.quiz_id = q.id AND r.completed AND r.completed_at::date = $1::date
			ORDER BY r.score DESC LIMIT 1
		) best ON TRUE
	`, [day, username]);
	const quiz = rows[0];
	if (!quiz) {
		return undefined;
	}
	return {
		id: quiz.id,
		title: quiz.title,
		description: quiz.config ? quiz.config.description : "",
		done: quiz.score !== null,
		score: quiz.score,
		total: quiz.total
	};
}

// Nombre de fois où ce quiz a déjà rapporté des points aujourd'hui
async function countRewardedToday(username, quizId) {
	const { rows } = await pool.query(`
		SELECT COUNT(*)::int AS n FROM quiz_results
		WHERE username = $1 AND quiz_id = $2 AND completed AND points > 0 AND completed_at::date = CURRENT_DATE
	`, [username, quizId]);
	return rows[0].n;
}

// ---------- Compagnon et boutique ----------

// Compagnon de l'élève (créé à la première visite), avec ses points et ses tenues
async function getCompanion(username) {
	await pool.query("INSERT INTO companions (username) VALUES ($1) ON CONFLICT DO NOTHING", [username]);
	const { rows } = await pool.query(`
		SELECT c.name, c.happiness, c.last_seen, c.visible, c.gifts, c.equipped, u.points,
			COALESCE((SELECT array_agg(item_id) FROM owned_items o WHERE o.username = c.username), '{}') AS owned
		FROM companions c JOIN users u ON u.username = c.username
		WHERE c.username = $1
	`, [username]);
	return rows[0];
}

async function updateCompanionPresence(username, happiness) {
	await pool.query("UPDATE companions SET happiness = $2, last_seen = NOW() WHERE username = $1", [username, happiness]);
}

// Retire les points si le solde suffit ; renvoie false sinon
async function spend(client, username, price) {
	const { rowCount } = await client.query(
		"UPDATE users SET points = points - $2 WHERE username = $1 AND points >= $2",
		[username, price]
	);
	return rowCount > 0;
}

async function buyGift(username, price, joy) {
	return transaction(async (client) => {
		if (!(await spend(client, username, price))) return false;
		await client.query(
			"UPDATE companions SET happiness = LEAST(100, happiness + $2), gifts = gifts + 1 WHERE username = $1",
			[username, joy]
		);
		return true;
	});
}

async function buyItem(username, itemId, price) {
	return transaction(async (client) => {
		if (!(await spend(client, username, price))) return false;
		await client.query("INSERT INTO owned_items (username, item_id) VALUES ($1, $2)", [username, itemId]);
		return true;
	});
}

// Met (itemId) ou retire (null) une tenue à un emplacement
async function equip(username, slot, itemId) {
	if (itemId === null) {
		await pool.query("UPDATE companions SET equipped = equipped - $2::text WHERE username = $1", [username, slot]);
	} else {
		await pool.query(
			"UPDATE companions SET equipped = equipped || jsonb_build_object($2::text, $3::text) WHERE username = $1",
			[username, slot, itemId]
		);
	}
}

async function renameCompanion(username, name) {
	await pool.query("UPDATE companions SET name = $2 WHERE username = $1", [username, name]);
}

async function setCompanionVisible(username, visible) {
	await pool.query("UPDATE companions SET visible = $2 WHERE username = $1", [username, visible]);
}

module.exports = {
	userExist,
	authentification,
	getStudents,
	isStudent,
	createStudent,
	setStudentPassword,
	deleteStudent,
	getQuizzes,
	getQuiz,
	createQuiz,
	updateQuiz,
	deleteQuiz,
	saveResult,
	getHistory,
	getResultDetail,
	getWeekPlan,
	getStudentNames,
	setDailyPlan,
	getDailyQuiz,
	countRewardedToday,
	getCompanion,
	updateCompanionPresence,
	buyGift,
	buyItem,
	equip,
	renameCompanion,
	setCompanionVisible
}
