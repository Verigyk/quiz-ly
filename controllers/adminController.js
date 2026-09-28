const db = require("../db");
const generators = require("../generators");
const dates = require("../dates");

// ---------- Élèves ----------

async function getStudents() {
	return db.getStudents();
}

function checkPassword(password) {
	if (password.length < 4) {
		throw new Error("Le mot de passe doit faire au moins 4 caractères.");
	}
}

async function createStudent(username, password) {
	username = username.normalize("NFC").trim();
	password = password.normalize("NFC");
	if (!/^[\p{L}\p{N}._-]{2,30}$/u.test(username)) {
		throw new Error("L'identifiant doit faire 2 à 30 caractères (lettres, chiffres, . _ -).");
	}
	checkPassword(password);
	if (await db.userExist(username)) {
		throw new Error(`L'identifiant « ${username} » est déjà utilisé.`);
	}
	await db.createStudent(username, password);
}

async function setStudentPassword(username, password) {
	password = password.normalize("NFC");
	checkPassword(password);
	await db.setStudentPassword(username, password);
}

async function deleteStudent(username) {
	await db.deleteStudent(username);
}

// Historique d'un élève ; null si ce n'est pas un élève
async function getStudentHistory(username) {
	if (!(await db.isStudent(username))) {
		return null;
	}
	return db.getHistory(username);
}

async function getStudentResult(username, resultId) {
	return db.getResultDetail(resultId, username);
}

// ---------- Quiz ----------

async function getQuizzes() {
	return db.getQuizzes();
}

// Quiz généré à modifier ; null s'il n'existe pas ou a été écrit à la main
async function getQuizConfig(id) {
	const quiz = await db.getQuiz(id);
	return quiz && quiz.config ? quiz.config : null;
}

function catalog() {
	return generators.catalog();
}

// Aperçu : questions générées avec la bonne réponse, sans rien enregistrer
function preview(rawConfig) {
	const config = generators.normalizeConfig(rawConfig);
	return generators.generateQuiz(config);
}

// Questions figées générées une fois pour toutes, ou null si régénérées à chaque tentative
function frozenQuestions(config) {
	if (config.regenerate) {
		return null;
	}
	return generators.generateQuiz(config).map(({ text, choices, answer }) => ({ text, choices, answer }));
}

async function saveQuiz(id, rawConfig) {
	const config = generators.normalizeConfig(rawConfig);
	if (id === null) {
		return db.createQuiz(config, frozenQuestions(config));
	}
	if (!(await getQuizConfig(id))) {
		throw new Error("Ce quiz n'existe pas ou ne peut pas être modifié.");
	}
	await db.updateQuiz(id, config, frozenQuestions(config));
	return id;
}

async function deleteQuiz(id) {
	await db.deleteQuiz(id);
}

// ---------- Quiz du jour ----------

// Semaine du lundi au dimanche contenant « day » : quiz de la classe et choix de chaque élève.
// Les jours passés ne sont plus modifiables.
async function getWeek(day) {
	const start = dates.mondayOf(dates.isISODate(day) ? day : dates.today());
	const [plan, students] = await Promise.all([db.getWeekPlan(start), db.getStudentNames()]);
	const today = dates.today();

	const classQuiz = Object.fromEntries(plan.defaults.map((d) => [d.day, d.quiz_id]));
	const override = Object.fromEntries(plan.overrides.map((o) => [o.day + "|" + o.username, o.quiz_id]));
	const completed = new Set(plan.completions.map((r) => `${r.day}|${r.username}|${r.quiz_id}`));

	const days = Array.from({ length: 7 }, (_, i) => {
		const iso = dates.addDays(start, i);
		return { day: iso, label: dates.label(iso), isToday: iso === today, isPast: iso < today, quizId: classQuiz[iso] ?? null };
	});

	const rows = students.map((username) => ({
		username,
		cells: days.map((d) => {
			const key = d.day + "|" + username;
			const hasOverride = key in override;
			// Valeur du menu : "classe", "aucun" ou l'id du quiz
			const choice = !hasOverride ? "classe" : override[key] === null ? "aucun" : String(override[key]);
			const quizId = hasOverride ? override[key] : d.quizId;
			return { choice, quizId, done: quizId !== null && completed.has(`${d.day}|${username}|${quizId}`) };
		})
	}));

	// Suivi par jour : élèves ayant un quiz ce jour-là, et combien l'ont terminé
	days.forEach((d, i) => {
		const assigned = rows.filter((r) => r.cells[i].quizId !== null);
		d.assigned = assigned.length;
		d.done = assigned.filter((r) => r.cells[i].done).length;
	});

	return { start, previous: dates.addDays(start, -7), next: dates.addDays(start, 7), days, rows };
}

// body.classe = { jour: id | "" } ; body.eleves = { élève: { jour: "classe" | "aucun" | id } }
// Seuls aujourd'hui et les jours suivants sont enregistrés
async function saveWeek(body) {
	const today = dates.today();
	const quizIds = new Set((await db.getQuizzes()).map((q) => q.id));
	const students = new Set(await db.getStudentNames());
	const editable = (day) => dates.isISODate(day) && day >= today;
	const checkQuiz = (value) => {
		const id = Number(value);
		if (!quizIds.has(id)) {
			throw new Error("Quiz inconnu.");
		}
		return id;
	};

	const defaults = Object.entries(body.classe || {})
		.filter(([day]) => editable(day))
		.map(([day, value]) => ({ day, quizId: value === "" ? null : checkQuiz(value) }));

	const overrides = [];
	for (const [username, byDay] of Object.entries(body.eleves || {})) {
		if (!students.has(username) || typeof byDay !== "object") {
			continue;
		}
		for (const [day, value] of Object.entries(byDay)) {
			if (!editable(day)) {
				continue;
			}
			const choice = value === "classe" || value === "aucun" ? value : checkQuiz(value);
			overrides.push({ day, username, choice });
		}
	}

	await db.setDailyPlan(defaults, overrides);
}

module.exports = {
	getStudents,
	createStudent,
	setStudentPassword,
	deleteStudent,
	getStudentHistory,
	getStudentResult,
	getQuizzes,
	getQuizConfig,
	catalog,
	preview,
	saveQuiz,
	deleteQuiz,
	getWeek,
	saveWeek,
	TRAP_MODES: generators.TRAP_MODES,
	LIMITS: generators.LIMITS
}
