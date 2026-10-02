const db = require("../db");
const generators = require("../generators");
const dates = require("../dates");
const templates = require("./templateController");
const linkDurations = require("../linkDurations");

// Toutes les fonctions reçoivent « me » : le professeur connecté.
// Un professeur ne voit et ne modifie que ses propres élèves (un élève peut avoir plusieurs professeurs).

// ---------- Élèves ----------

async function getStudents(me) {
	const [mine, unassigned, code] = await Promise.all([db.getStudents(me), db.getStudents(null), db.getLinkCode(me)]);
	return { mine, unassigned, code };
}

function checkPassword(password) {
	if (password.length < 4) {
		throw new Error("Le mot de passe doit faire au moins 4 caractères.");
	}
}

// L'élève créé appartient au professeur qui le crée
async function createStudent(me, username, password) {
	username = username.normalize("NFC").trim();
	password = password.normalize("NFC");
	if (!/^[\p{L}\p{N}._-]{2,30}$/u.test(username)) {
		throw new Error("L'identifiant doit faire 2 à 30 caractères (lettres, chiffres, . _ -).");
	}
	checkPassword(password);
	if (await db.userExist(username)) {
		throw new Error(`L'identifiant « ${username} » est déjà utilisé.`);
	}
	await db.createStudent(username, password, me);
}

async function setStudentPassword(me, username, password) {
	password = password.normalize("NFC");
	checkPassword(password);
	if (!(await db.setStudentPassword(username, password, me))) {
		throw new Error("Cet élève n'est pas dans votre liste.");
	}
}

// Supprimer le compte n'est possible que pour son unique professeur ; sinon, on le retire de sa liste
async function deleteStudent(me, username) {
	if (!(await db.isStudentOf(username, me))) {
		throw new Error("Cet élève n'est pas dans votre liste.");
	}
	if (!(await db.deleteStudent(username, me))) {
		throw new Error("Cet élève a d'autres professeurs : retirez-le de votre liste au lieu de supprimer son compte.");
	}
}

// Retirer un élève de sa liste : son compte et ses autres professeurs restent
async function unlinkStudent(me, username) {
	if (!(await db.unlinkStudent(me, username))) {
		throw new Error("Cet élève n'est pas dans votre liste.");
	}
}

// Prendre en charge un élève qui n'a aucun professeur
async function claimStudent(me, username) {
	if (!(await db.claimStudent(me, username))) {
		throw new Error("Cet élève a déjà un professeur : demandez-lui son code.");
	}
}

// Ajouter un élève grâce au code qu'il a généré (usage unique) ; renvoie son identifiant
async function linkByCode(me, code) {
	const result = await db.useLinkCode(code, "student", me);
	if (!result) {
		throw new Error("Aucun élève ne correspond à ce code (il a peut-être expiré ou déjà servi).");
	}
	if (!result.linked) {
		throw new Error(`« ${result.owner} » fait déjà partie de vos élèves.`);
	}
	return result.owner;
}

// body : durée choisie dans le formulaire (voir linkDurations.js)
async function createCode(me, body) {
	return db.createLinkCode(me, linkDurations.parse(body));
}

// Historique d'un de ses élèves ; null si ce n'est pas son élève
async function getStudentHistory(me, username) {
	if (!(await db.isStudentOf(username, me))) {
		return null;
	}
	return db.getHistory(username);
}

async function getStudentResult(me, username, resultId) {
	if (!(await db.isStudentOf(username, me))) {
		return null;
	}
	return db.getResultDetail(resultId, username);
}

// ---------- Quiz ----------

// Un quiz commun (sans propriétaire) peut être modifié par tous les professeurs
function canEdit(quiz, me) {
	return quiz.owner === null || quiz.owner === me;
}

// Quiz accessibles au professeur, avec ce qu'il a le droit d'en faire
async function getQuizzes(me) {
	const quizzes = await db.getQuizzes(me);
	return quizzes.map((q) => ({ ...q, editable: canEdit(q, me) }));
}

// Quiz généré à modifier ; null s'il n'existe pas, a été écrit à la main ou appartient à un autre professeur
async function getQuizForEdit(me, id) {
	const quiz = await db.getQuiz(id);
	if (!quiz || !quiz.config || quiz.config.manual || !canEdit(quiz, me)) {
		return null;
	}
	return { config: quiz.config, students: quiz.access };
}

// Élèves que le professeur peut autoriser : les siens
async function getAccessChoices(me) {
	return db.getStudentNames(me);
}

// Élèves cochés dans le formulaire. On ne garde que ceux du professeur, plus ceux qui avaient
// déjà accès au quiz (par exemple un élève confié depuis à un collègue), pour ne pas les retirer sans le vouloir.
async function normalizeStudents(me, raw, previous = []) {
	const allowed = new Set([...(await db.getStudentNames(me)), ...previous]);
	return [...new Set((Array.isArray(raw) ? raw : []).map(String))].filter((u) => allowed.has(u));
}

// Chapitres intégrés + catégories personnelles du professeur
async function catalog(me) {
	return generators.catalog(await templates.chaptersFor(me));
}

// Aperçu : questions générées avec la bonne réponse, sans rien enregistrer
async function preview(me, rawConfig) {
	const extra = await templates.chaptersFor(me);
	const config = generators.normalizeConfig(rawConfig, extra);
	return generators.generateQuiz(config, extra);
}

// Questions figées générées une fois pour toutes, ou null si régénérées à chaque tentative
function frozenQuestions(config, extra) {
	if (config.regenerate) {
		return null;
	}
	return generators.generateQuiz(config, extra).map(({ text, choices, answer }) => ({ text, choices, answer }));
}

async function saveQuiz(me, id, body) {
	const extra = await templates.chaptersFor(me);
	const config = generators.normalizeConfig(body, extra);
	if (id === null) {
		return db.createQuiz(config, frozenQuestions(config, extra), me, await normalizeStudents(me, body.students));
	}
	const saved = await getQuizForEdit(me, id);
	if (!saved) {
		throw new Error("Ce quiz n'existe pas ou vous ne pouvez pas le modifier.");
	}
	await db.updateQuiz(id, config, frozenQuestions(config, extra), await normalizeStudents(me, body.students, saved.students));
	return id;
}

// ---------- Quiz écrits à la main ----------

// Quiz manuel à modifier (y compris les anciens quiz sans configuration) ; null sinon
async function getManualQuizForEdit(me, id) {
	const quiz = await db.getQuiz(id);
	if (!quiz || (quiz.config && !quiz.config.manual) || !canEdit(quiz, me)) {
		return null;
	}
	return {
		title: quiz.title,
		description: quiz.config ? quiz.config.description || "" : "",
		questions: quiz.questions,
		students: quiz.access
	};
}

// Vérifie les questions écrites dans le formulaire : [{ text, choices: [..], answer: index }]
function normalizeManual(body) {
	const title = String(body.title || "").trim();
	if (!title || title.length > 100) throw new Error("Le titre est obligatoire (100 caractères maximum).");
	const raw = Array.isArray(body.questions) ? body.questions : [];
	if (raw.length === 0 || raw.length > 50) throw new Error("Écrivez entre 1 et 50 questions.");
	const questions = raw.map((q, i) => {
		const text = String(q.text || "").trim().slice(0, 500);
		const choices = (Array.isArray(q.choices) ? q.choices : []).map((c) => String(c).trim().slice(0, 200)).filter(Boolean);
		if (!text) throw new Error(`Question ${i + 1} : écrivez l'énoncé.`);
		if (choices.length < 2 || choices.length > 6) throw new Error(`Question ${i + 1} : il faut entre 2 et 6 réponses.`);
		if (new Set(choices).size !== choices.length) throw new Error(`Question ${i + 1} : deux réponses sont identiques.`);
		const answer = Number(q.answer);
		if (!Number.isInteger(answer) || answer < 0 || answer >= choices.length) throw new Error(`Question ${i + 1} : cochez la bonne réponse.`);
		return { text, choices, answer };
	});
	return { config: { manual: true, title, description: String(body.description || "").trim().slice(0, 500) }, questions };
}

async function saveManualQuiz(me, id, body) {
	const { config, questions } = normalizeManual(body);
	if (id === null) {
		return db.createQuiz(config, questions, me, await normalizeStudents(me, body.students));
	}
	const saved = await getManualQuizForEdit(me, id);
	if (!saved) {
		throw new Error("Ce quiz n'existe pas ou vous ne pouvez pas le modifier.");
	}
	await db.updateQuiz(id, config, questions, await normalizeStudents(me, body.students, saved.students));
	return id;
}

// Élèves d'un quiz (écrit à la main ou généré) ; null si le professeur ne peut pas le modifier
async function getQuizStudents(me, id) {
	const quiz = await db.getQuiz(id);
	if (!quiz || !canEdit(quiz, me)) {
		return null;
	}
	return { id: quiz.id, title: quiz.title, students: quiz.access };
}

async function saveQuizStudents(me, id, raw) {
	const quiz = await getQuizStudents(me, id);
	if (!quiz) {
		throw new Error("Ce quiz n'existe pas ou vous ne pouvez pas le modifier.");
	}
	// Une seule case cochée arrive sous forme de texte, plusieurs sous forme de liste
	await db.setQuizStudents(id, await normalizeStudents(me, [].concat(raw ?? []), quiz.students));
}

async function deleteQuiz(me, id) {
	const quiz = await db.getQuiz(id);
	if (!quiz || !canEdit(quiz, me)) {
		throw new Error("Seul le professeur qui a créé ce quiz peut le supprimer.");
	}
	await db.deleteQuiz(id);
}

// ---------- Quiz du jour ----------

// Semaine du lundi au dimanche contenant « day » : quiz de sa classe et choix pour chacun de ses élèves.
// Les jours passés ne sont plus modifiables.
async function getWeek(me, day) {
	const start = dates.mondayOf(dates.isISODate(day) ? day : dates.today());
	const [plan, students] = await Promise.all([db.getWeekPlan(start, me), db.getStudentNames(me)]);
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
// Seuls aujourd'hui et les jours suivants sont enregistrés, et seulement pour ses élèves
async function saveWeek(me, body) {
	const today = dates.today();
	const quizIds = new Set((await db.getQuizzes(me)).map((q) => q.id));
	const students = new Set(await db.getStudentNames(me));
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

	await db.setDailyPlan(me, defaults, overrides);
}

module.exports = {
	getStudents,
	createStudent,
	setStudentPassword,
	deleteStudent,
	unlinkStudent,
	claimStudent,
	linkByCode,
	createCode,
	getStudentHistory,
	getStudentResult,
	getQuizzes,
	getQuizForEdit,
	getAccessChoices,
	catalog,
	preview,
	saveQuiz,
	getManualQuizForEdit,
	saveManualQuiz,
	getQuizStudents,
	saveQuizStudents,
	deleteQuiz,
	getWeek,
	saveWeek,
	TRAP_MODES: generators.TRAP_MODES,
	LIMITS: generators.LIMITS
}
