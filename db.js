const bcrypt = require("bcrypt");
const crypto = require("crypto");
const pool = require("./db/pool");

// ---------- Comptes ----------
// Un élève peut avoir plusieurs professeurs : les liens sont dans teacher_students.

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

// Élèves d'un professeur (teacher = null : élèves qui n'ont aucun professeur), avec leurs statistiques
// et le nombre de professeurs de chacun
async function getStudents(teacher) {
	const { rows } = await pool.query(`
		SELECT u.username, u.created_at, u.points,
			(SELECT COUNT(*)::int FROM teacher_students l WHERE l.student = u.username) AS teachers,
			COUNT(r.id)::int AS attempts,
			COUNT(r.id) FILTER (WHERE r.completed)::int AS completed,
			ROUND(AVG(100.0 * r.score / NULLIF(r.total, 0)) FILTER (WHERE r.completed))::int AS average,
			MAX(r.completed_at) AS last_activity
		FROM users u
		LEFT JOIN quiz_results r ON r.username = u.username
		WHERE u.role = 'student' AND (
			($1::text IS NULL AND NOT EXISTS (SELECT 1 FROM teacher_students l WHERE l.student = u.username))
			OR EXISTS (SELECT 1 FROM teacher_students l WHERE l.student = u.username AND l.teacher = $1)
		)
		GROUP BY u.username
		ORDER BY u.username
	`, [teacher]);
	return rows;
}

async function getTeachers() {
	const { rows } = await pool.query("SELECT username FROM users WHERE role = 'admin' ORDER BY username");
	return rows.map((r) => r.username);
}

// Professeurs d'un élève
async function getTeachersOf(student) {
	const { rows } = await pool.query(
		"SELECT teacher FROM teacher_students WHERE student = $1 ORDER BY teacher",
		[student]
	);
	return rows.map((r) => r.teacher);
}

// L'élève fait-il partie des élèves de ce professeur ?
async function isStudentOf(username, teacher) {
	const { rowCount } = await pool.query(
		"SELECT 1 FROM teacher_students WHERE student = $1 AND teacher = $2",
		[username, teacher]
	);
	return rowCount > 0;
}

// L'élève créé est rattaché au professeur qui le crée
async function createStudent(username, password, teacher) {
	const hash = await bcrypt.hash(password, 10);
	await transaction(async (client) => {
		await client.query("INSERT INTO users (username, password_hash, role) VALUES ($1, $2, 'student')", [username, hash]);
		await client.query("INSERT INTO teacher_students (teacher, student) VALUES ($1, $2)", [teacher, username]);
	});
}

// Les modifications ne s'appliquent qu'aux élèves du professeur ; renvoie false sinon
async function setStudentPassword(username, password, teacher) {
	if (!(await isStudentOf(username, teacher))) return false;
	const hash = await bcrypt.hash(password, 10);
	await pool.query("UPDATE users SET password_hash = $2 WHERE username = $1 AND role = 'student'", [username, hash]);
	return true;
}

// Supprime le compte et tout son historique : seulement si ce professeur est son unique professeur
async function deleteStudent(username, teacher) {
	const { rowCount } = await pool.query(`
		DELETE FROM users u
		WHERE u.username = $1 AND u.role = 'student'
			AND EXISTS (SELECT 1 FROM teacher_students l WHERE l.student = u.username AND l.teacher = $2)
			AND (SELECT COUNT(*) FROM teacher_students l WHERE l.student = u.username) = 1
	`, [username, teacher]);
	return rowCount > 0;
}

// Défait le lien : l'élève garde son compte et ses autres professeurs.
// Ses choix de quiz du jour chez ce professeur disparaissent.
async function unlinkStudent(teacher, student) {
	return transaction(async (client) => {
		const { rowCount } = await client.query("DELETE FROM teacher_students WHERE teacher = $1 AND student = $2", [teacher, student]);
		await client.query("DELETE FROM daily_student_quizzes WHERE teacher = $1 AND username = $2", [teacher, student]);
		return rowCount > 0;
	});
}

// Prendre en charge un élève qui n'a aucun professeur
async function claimStudent(teacher, student) {
	const { rowCount } = await pool.query(`
		INSERT INTO teacher_students (teacher, student)
		SELECT $1, u.username FROM users u
		WHERE u.username = $2 AND u.role = 'student'
			AND NOT EXISTS (SELECT 1 FROM teacher_students l WHERE l.student = u.username)
	`, [teacher, student]);
	return rowCount > 0;
}

// ---------- Codes d'association ----------
// Un compte peut générer un code (ex. « K7PX-3QMA ») : un professeur entre le code d'un élève
// pour l'ajouter à ses élèves, un élève entre le code d'un professeur pour le rejoindre.
// Le code est à usage unique (effacé dès qu'il a servi) ; sa durée de validité est choisie à la création
// (voir linkDurations.js). Un code sans expiration a la date « infinity ».
// Alphabet sans caractères ambigus (0/O, 1/I/L).

const CODE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";

function newCode() {
	const chars = Array.from(crypto.randomBytes(8), (b) => CODE_ALPHABET[b % CODE_ALPHABET.length]);
	return chars.slice(0, 4).join("") + "-" + chars.slice(4).join("");
}

// Code encore valable du compte : { code, expiresAt }, ou null s'il n'en a pas (jamais créé, déjà utilisé ou expiré)
async function getLinkCode(username) {
	const { rows } = await pool.query(
		"SELECT link_code, link_code_expires FROM users WHERE username = $1 AND link_code IS NOT NULL AND link_code_expires > NOW()",
		[username]
	);
	return rows[0] ? { code: rows[0].link_code, expiresAt: rows[0].link_code_expires } : null;
}

// Nouveau code valable « minutes » minutes (null : sans expiration) ; l'ancien ne marche plus
async function createLinkCode(username, minutes) {
	for (let tries = 0; tries < 5; tries++) {
		const code = newCode();
		try {
			const { rows } = await pool.query(`
				UPDATE users SET link_code = $2,
					link_code_expires = CASE WHEN $3::int IS NULL THEN 'infinity'::timestamptz ELSE NOW() + make_interval(mins => $3::int) END
				WHERE username = $1 RETURNING link_code_expires
			`, [username, code, minutes]);
			return { code, expiresAt: rows[0].link_code_expires };
		} catch (error) {
			if (error.code !== "23505") throw error; // code déjà pris : on en tire un autre
		}
	}
	throw new Error("Impossible de générer un code, réessayez.");
}

// Code saisi (majuscules, tiret facultatif) → forme enregistrée « ABCD-EFGH », ou null s'il est mal formé
function cleanCode(code) {
	const clean = String(code || "").toUpperCase().replace(/[^A-Z0-9]/g, "");
	return clean.length === 8 ? clean.slice(0, 4) + "-" + clean.slice(4) : null;
}

// Utilise un code : trouve le compte qui l'a créé (avec le bon rôle, code encore valable), crée le lien
// professeur ↔ élève avec « other », puis efface le code. Renvoie { owner, linked } ou null si le code
// n'est pas valable. S'ils étaient déjà liés, le code n'est pas consommé (linked = false).
async function useLinkCode(code, role, other) {
	const formatted = cleanCode(code);
	if (!formatted) return null;
	return transaction(async (client) => {
		const { rows } = await client.query(`
			SELECT username FROM users
			WHERE link_code = $1 AND role = $2 AND link_code_expires > NOW()
			FOR UPDATE
		`, [formatted, role]);
		if (rows.length === 0) return null;
		const owner = rows[0].username;
		const [teacher, student] = role === "admin" ? [owner, other] : [other, owner];
		const { rowCount } = await client.query(
			"INSERT INTO teacher_students (teacher, student) VALUES ($1, $2) ON CONFLICT DO NOTHING",
			[teacher, student]
		);
		if (rowCount > 0) {
			await client.query("UPDATE users SET link_code = NULL, link_code_expires = NULL WHERE username = $1", [owner]);
		}
		return { owner, linked: rowCount > 0 };
	});
}

// ---------- Quiz ----------
// Un quiz est accessible à son créateur et aux élèves choisis (quiz_access).
// Un ancien quiz commun (sans créateur) est visible par tous les professeurs.

function accessible(param) {
	return `(q.owner = ${param}
		OR EXISTS (SELECT 1 FROM quiz_access a WHERE a.quiz_id = q.id AND a.username = ${param})
		OR (q.owner IS NULL AND EXISTS (SELECT 1 FROM users t WHERE t.username = ${param} AND t.role = 'admin')))`;
}

// Quiz écrit à la main : config = { manual: true, title, description } et questions enregistrées
function isGenerated(config) {
	return Boolean(config) && !config.manual;
}

// Nombre de questions : fixé par la configuration si les questions sont régénérées à chaque tentative
function questionCount(quiz, storedCount) {
	return quiz.config && quiz.config.regenerate ? quiz.config.questionCount : storedCount;
}

// Quiz accessibles à cet utilisateur
async function getQuizzes(username) {
	const { rows } = await pool.query(`
		SELECT q.id, q.title, q.config, q.owner, q.created_at,
			(SELECT COUNT(*)::int FROM questions qu WHERE qu.quiz_id = q.id) AS stored,
			COALESCE((SELECT array_agg(a.username ORDER BY a.username) FROM quiz_access a WHERE a.quiz_id = q.id), '{}') AS access
		FROM quizzes q
		WHERE ${accessible("$1")}
		ORDER BY q.id
	`, [username]);
	return rows.map((q) => ({
		id: q.id,
		title: q.title,
		config: q.config,
		owner: q.owner,
		access: q.access,
		description: q.config ? q.config.description : "",
		generated: isGenerated(q.config),
		manual: Boolean(q.config && q.config.manual),
		count: questionCount(q, q.stored),
		created_at: q.created_at
	}));
}

async function canAccessQuiz(id, username) {
	const { rowCount } = await pool.query(`SELECT 1 FROM quizzes q WHERE q.id = $1 AND ${accessible("$2")}`, [id, username]);
	return rowCount > 0;
}

// Renvoie le quiz avec ses questions enregistrées (vide si elles sont régénérées), ou undefined
async function getQuiz(id) {
	const quizResult = await pool.query(`
		SELECT q.id, q.title, q.config, q.owner,
			COALESCE((SELECT array_agg(a.username ORDER BY a.username) FROM quiz_access a WHERE a.quiz_id = q.id), '{}') AS access
		FROM quizzes q WHERE q.id = $1
	`, [id]);
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

// students = élèves autorisés à faire le quiz
async function setAccess(client, quizId, students) {
	await client.query("DELETE FROM quiz_access WHERE quiz_id = $1", [quizId]);
	for (const username of students) {
		await client.query("INSERT INTO quiz_access (quiz_id, username) VALUES ($1, $2) ON CONFLICT DO NOTHING", [quizId, username]);
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
// students = élèves autorisés à faire le quiz
async function createQuiz(config, questions, owner, students) {
	return transaction(async (client) => {
		const { rows } = await client.query(
			"INSERT INTO quizzes (title, config, owner) VALUES ($1, $2, $3) RETURNING id",
			[config.title, config, owner]
		);
		if (questions) {
			await insertQuestions(client, rows[0].id, questions);
		}
		await setAccess(client, rows[0].id, students);
		return rows[0].id;
	});
}

async function updateQuiz(id, config, questions, students) {
	await transaction(async (client) => {
		await client.query("UPDATE quizzes SET title = $2, config = $3 WHERE id = $1", [id, config.title, config]);
		await client.query("DELETE FROM questions WHERE quiz_id = $1", [id]);
		if (questions) {
			await insertQuestions(client, id, questions);
		}
		await setAccess(client, id, students);
	});
}

async function setQuizStudents(id, students) {
	await transaction((client) => setAccess(client, id, students));
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
// daily_quizzes : quiz de la classe d'un professeur pour un jour.
// daily_student_quizzes : choix particulier d'un professeur pour un de ses élèves ce jour-là
// (quiz_id NULL = pas de quiz de ce professeur pour lui).

// Planning de 7 jours à partir de start pour un professeur : quiz de sa classe, choix par élève, quiz terminés
async function getWeekPlan(start, teacher) {
	const range = "BETWEEN $1::date AND $1::date + 6";
	const [defaults, overrides, completions] = await Promise.all([
		pool.query(`SELECT day::text AS day, quiz_id FROM daily_quizzes WHERE teacher = $2 AND day ${range}`, [start, teacher]),
		pool.query(`SELECT day::text AS day, username, quiz_id FROM daily_student_quizzes WHERE teacher = $2 AND day ${range}`, [start, teacher]),
		pool.query(`
			SELECT DISTINCT r.completed_at::date::text AS day, r.username, r.quiz_id
			FROM quiz_results r JOIN teacher_students l ON l.student = r.username AND l.teacher = $2
			WHERE r.completed AND r.quiz_id IS NOT NULL AND r.completed_at::date ${range}
		`, [start, teacher])
	]);
	return { defaults: defaults.rows, overrides: overrides.rows, completions: completions.rows };
}

async function getStudentNames(teacher) {
	const { rows } = await pool.query("SELECT student FROM teacher_students WHERE teacher = $1 ORDER BY student", [teacher]);
	return rows.map((r) => r.student);
}

// defaults = [{ day, quizId | null }] pour la classe du professeur
// overrides = [{ day, username, choice }] avec choice = "classe" (suit la classe), "aucun" ou un id de quiz
async function setDailyPlan(teacher, defaults, overrides) {
	await transaction(async (client) => {
		for (const { day, quizId } of defaults) {
			if (quizId === null) {
				await client.query("DELETE FROM daily_quizzes WHERE day = $1 AND teacher = $2", [day, teacher]);
			} else {
				await client.query(`
					INSERT INTO daily_quizzes (day, teacher, quiz_id) VALUES ($1, $2, $3)
					ON CONFLICT (day, teacher) DO UPDATE SET quiz_id = EXCLUDED.quiz_id
				`, [day, teacher, quizId]);
			}
		}
		for (const { day, username, choice } of overrides) {
			if (choice === "classe") {
				await client.query("DELETE FROM daily_student_quizzes WHERE day = $1 AND teacher = $2 AND username = $3", [day, teacher, username]);
			} else {
				await client.query(`
					INSERT INTO daily_student_quizzes (day, teacher, username, quiz_id) VALUES ($1, $2, $3, $4)
					ON CONFLICT (day, teacher, username) DO UPDATE SET quiz_id = EXCLUDED.quiz_id
				`, [day, teacher, username, choice === "aucun" ? null : choice]);
			}
		}
	});
}

// Quiz du jour d'un élève : un par professeur au plus (choix particulier du professeur, sinon quiz de sa classe),
// avec le meilleur score du jour s'il l'a déjà terminé
async function getDailyQuizzes(day, username) {
	const { rows } = await pool.query(`
		WITH chosen AS (
			SELECT l.teacher,
				CASE WHEN s.username IS NOT NULL THEN s.quiz_id ELSE d.quiz_id END AS quiz_id
			FROM teacher_students l
			LEFT JOIN daily_student_quizzes s ON s.day = $1::date AND s.teacher = l.teacher AND s.username = l.student
			LEFT JOIN daily_quizzes d ON d.day = $1::date AND d.teacher = l.teacher
			WHERE l.student = $2
		)
		SELECT DISTINCT ON (q.id) q.id, q.title, q.config, chosen.teacher, best.score, best.total
		FROM chosen
		JOIN quizzes q ON q.id = chosen.quiz_id
		LEFT JOIN LATERAL (
			SELECT r.score, r.total FROM quiz_results r
			WHERE r.username = $2 AND r.quiz_id = q.id AND r.completed AND r.completed_at::date = $1::date
			ORDER BY r.score DESC LIMIT 1
		) best ON TRUE
		ORDER BY q.id, chosen.teacher
	`, [day, username]);
	return rows.map((quiz) => ({
		id: quiz.id,
		title: quiz.title,
		teacher: quiz.teacher,
		description: quiz.config ? quiz.config.description : "",
		done: quiz.score !== null,
		score: quiz.score,
		total: quiz.total
	}));
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
			c.checked_until::text AS checked_until, c.missed_quizzes, c.missed_on::text AS missed_on,
			COALESCE((SELECT array_agg(item_id) FROM owned_items o WHERE o.username = c.username), '{}') AS owned
		FROM companions c JOIN users u ON u.username = c.username
		WHERE c.username = $1
	`, [username]);
	return rows[0];
}

async function updateCompanionPresence(username, happiness) {
	await pool.query("UPDATE companions SET happiness = $2, last_seen = NOW() WHERE username = $1", [username, happiness]);
}

// Enregistre la vérification des quiz du jour oubliés jusqu'à « until » (inclus)
async function updateCompanionMissed(username, happiness, until, missed, missedOn) {
	await pool.query(
		"UPDATE companions SET happiness = $2, checked_until = $3, missed_quizzes = $4, missed_on = $5 WHERE username = $1",
		[username, happiness, until, missed, missedOn]
	);
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

// ---------- Catégories et modèles de questions personnels ----------

async function getCategories(owner) {
	const [categories, templates] = await Promise.all([
		pool.query("SELECT id, name FROM categories WHERE owner = $1 ORDER BY name", [owner]),
		pool.query("SELECT id, category_id, definition FROM templates WHERE owner = $1 ORDER BY definition->>'name'", [owner])
	]);
	return categories.rows.map((c) => ({ ...c, templates: templates.rows.filter((t) => t.category_id === c.id) }));
}

async function createCategory(owner, name) {
	const { rows } = await pool.query("INSERT INTO categories (owner, name) VALUES ($1, $2) RETURNING id", [owner, name]);
	return rows[0].id;
}

async function renameCategory(owner, id, name) {
	const { rowCount } = await pool.query("UPDATE categories SET name = $3 WHERE id = $2 AND owner = $1", [owner, id, name]);
	return rowCount > 0;
}

// Supprime la catégorie et ses modèles
async function deleteCategory(owner, id) {
	const { rowCount } = await pool.query("DELETE FROM categories WHERE id = $2 AND owner = $1", [owner, id]);
	return rowCount > 0;
}

async function ownsCategory(owner, id) {
	const { rowCount } = await pool.query("SELECT 1 FROM categories WHERE id = $2 AND owner = $1", [owner, id]);
	return rowCount > 0;
}

async function getTemplate(owner, id) {
	const { rows } = await pool.query("SELECT id, category_id, definition FROM templates WHERE id = $2 AND owner = $1", [owner, id]);
	return rows[0];
}

async function createTemplate(owner, categoryId, definition) {
	const { rows } = await pool.query(
		"INSERT INTO templates (owner, category_id, definition) VALUES ($1, $2, $3) RETURNING id",
		[owner, categoryId, definition]
	);
	return rows[0].id;
}

async function updateTemplate(owner, id, categoryId, definition) {
	const { rowCount } = await pool.query(
		"UPDATE templates SET category_id = $3, definition = $4 WHERE id = $2 AND owner = $1",
		[owner, id, categoryId, definition]
	);
	return rowCount > 0;
}

async function deleteTemplate(owner, id) {
	const { rowCount } = await pool.query("DELETE FROM templates WHERE id = $2 AND owner = $1", [owner, id]);
	return rowCount > 0;
}

// Modèles utilisés par un quiz (quel que soit l'élève qui le lance), avec leur catégorie
async function getTemplatesByIds(ids) {
	if (ids.length === 0) return [];
	const { rows } = await pool.query(`
		SELECT t.id, t.definition, c.id AS category_id, c.name AS category_name
		FROM templates t JOIN categories c ON c.id = t.category_id
		WHERE t.id = ANY($1::int[])
	`, [ids]);
	return rows;
}

// ---------- Plage ----------

// Personnages de la plage : pour un élève, lui-même et les élèves qui partagent un de ses professeurs ;
// pour un professeur, ses élèves. Un élève qui n'a jamais ouvert son compagnon a les valeurs par défaut.
async function getBeachCharacters(username, role) {
	const who = role === "admin"
		? "EXISTS (SELECT 1 FROM teacher_students l WHERE l.teacher = $1 AND l.student = u.username)"
		: `(u.username = $1 OR EXISTS (
			SELECT 1 FROM teacher_students a JOIN teacher_students b ON a.teacher = b.teacher
			WHERE a.student = $1 AND b.student = u.username))`;
	const { rows } = await pool.query(`
		SELECT u.username,
			COALESCE(c.name, 'Nino') AS name,
			COALESCE(c.happiness, 60) AS happiness,
			COALESCE(c.equipped, '{}') AS equipped,
			(SELECT COUNT(*)::int FROM quiz_results r WHERE r.username = u.username AND r.completed) AS completed
		FROM users u
		LEFT JOIN companions c ON c.username = u.username
		WHERE u.role = 'student' AND ${who}
		ORDER BY u.username
		LIMIT 40
	`, [username]);
	return rows;
}

module.exports = {
	userExist,
	authentification,
	getStudents,
	getTeachers,
	getTeachersOf,
	isStudentOf,
	createStudent,
	setStudentPassword,
	deleteStudent,
	unlinkStudent,
	claimStudent,
	getLinkCode,
	createLinkCode,
	useLinkCode,
	getQuizzes,
	canAccessQuiz,
	getQuiz,
	createQuiz,
	updateQuiz,
	setQuizStudents,
	deleteQuiz,
	saveResult,
	getHistory,
	getResultDetail,
	getWeekPlan,
	getStudentNames,
	setDailyPlan,
	getDailyQuizzes,
	countRewardedToday,
	getCompanion,
	updateCompanionPresence,
	updateCompanionMissed,
	buyGift,
	buyItem,
	equip,
	renameCompanion,
	setCompanionVisible,
	getCategories,
	createCategory,
	renameCategory,
	deleteCategory,
	ownsCategory,
	getTemplate,
	createTemplate,
	updateTemplate,
	deleteTemplate,
	getTemplatesByIds,
	getBeachCharacters
}
