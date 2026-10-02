const db = require("../db");
const generators = require("../generators");
const dates = require("../dates");
const companion = require("../companion");
const templates = require("./templateController");
const linkDurations = require("../linkDurations");

// Quiz visibles par cet utilisateur (communs, ou restreints avec son accès)
async function getQuizzes(username) {
	return db.getQuizzes(username);
}

// Un élève peut lancer un quiz auquel il a accès, ou le quiz du jour choisi pour lui par son professeur
async function canStart(username, quizId) {
	if (await db.canAccessQuiz(quizId, username)) {
		return true;
	}
	const daily = await db.getDailyQuizzes(dates.today(), username);
	return daily.some((d) => d.id === quizId);
}

// Questions d'une tentative : générées à la volée (avec les modèles personnels du quiz), ou enregistrées
async function questionsFor(quiz) {
	if (quiz.config && quiz.config.regenerate) {
		const extra = await templates.chaptersForConfig(quiz.config);
		return generators.generateQuiz(quiz.config, extra).map(({ text, choices, answer }) => ({ text, choices, answer }));
	}
	return quiz.questions;
}

// Enregistre un quiz commencé mais pas terminé comme abandonné
async function saveAbandoned(session) {
	const previous = session.quiz;
	if (previous && previous.answers.length > 0 && previous.index < previous.questions.length) {
		await db.saveResult(session.username, previous.id, previous.title, previous.score, previous.questions.length, previous.answers, false);
	}
}

// Initialise la tentative dans la session : les questions y sont copiées pour toute sa durée
async function startQuiz(session, quizId) {
	const quiz = await db.getQuiz(quizId);
	if (!quiz) {
		throw new Error("Quiz does not exist.");
	}
	if (!(await canStart(session.username, quiz.id))) {
		throw new Error("No access to this quiz.");
	}
	const questions = await questionsFor(quiz);
	if (questions.length === 0) {
		throw new Error("Quiz has no questions.");
	}

	await saveAbandoned(session);
	session.quiz = { id: quiz.id, title: quiz.title, questions, index: 0, score: 0, answers: [] };
}

// Réussite de chaque question déjà répondue (pour la barre de progression)
function marks(progress) {
	return progress.answers.map((a) => a.chosen === a.answer);
}

// Nombre de bonnes réponses d'affilée à la fin
function streak(progress) {
	let n = 0;
	for (let i = progress.answers.length - 1; i >= 0 && progress.answers[i].chosen === progress.answers[i].answer; i--) {
		n++;
	}
	return n;
}

// Appréciation selon le pourcentage de réussite
function rank(score, total) {
	const ratio = total ? score / total : 0;
	if (ratio === 1) return { name: "Sans faute !", icon: "🏆" };
	if (ratio >= 0.8) return { name: "Excellent travail", icon: "🌟" };
	if (ratio >= 0.6) return { name: "Bon travail", icon: "👍" };
	if (ratio >= 0.4) return { name: "En progrès", icon: "📈" };
	return { name: "À retravailler", icon: "📚" };
}

// Renvoie la question en cours, ou null si aucun quiz n'est en cours ou s'il est terminé
async function getCurrentQuestion(session) {
	const progress = session.quiz;
	if (!progress || progress.index >= progress.questions.length) {
		return null;
	}

	const { text, choices } = progress.questions[progress.index];
	return {
		quizId: progress.id,
		title: progress.title,
		number: progress.index + 1,
		total: progress.questions.length,
		text,
		choices,
		marks: marks(progress),
		streak: streak(progress)
	};
}

// Vérifie la réponse, met à jour le score et passe à la question suivante.
// Renvoie le retour à afficher : réponse juste ou non, bonne réponse, série en cours
async function submitAnswer(session, answer) {
	const progress = session.quiz;
	if (!progress) {
		throw new Error("No quiz in progress.");
	}

	const question = progress.questions[progress.index];
	if (!question) {
		return null;
	}

	const chosen = Number(answer);
	const valid = Number.isInteger(chosen) && chosen >= 0 && chosen < question.choices.length;
	if (valid && chosen === question.answer) {
		progress.score++;
	}
	progress.answers.push({ ...question, chosen: valid ? chosen : -1 });
	progress.index++;

	// Dernière question : on enregistre le résultat dans l'historique
	if (progress.index === progress.questions.length) {
		const total = progress.questions.length;
		const [rewarded, daily] = await Promise.all([
			db.countRewardedToday(session.username, progress.id),
			db.getDailyQuizzes(dates.today(), session.username)
		]);
		const isDailyFirst = daily.some((d) => d.id === progress.id && !d.done);
		progress.limitReached = rewarded >= companion.MAX_REWARDED_PER_DAY;
		progress.points = progress.limitReached ? 0 : companion.quizPoints(progress.score, total, isDailyFirst);
		progress.dailyBonus = isDailyFirst && !progress.limitReached;
		await db.saveResult(session.username, progress.id, progress.title, progress.score, total, progress.answers, true, progress.points, companion.QUIZ_JOY);
	}

	const correct = valid && chosen === question.answer;
	return { correct, answer: question.choices[question.answer], streak: streak(progress) };
}

async function getResult(session) {
	const progress = session.quiz;
	if (!progress || progress.index < progress.questions.length) {
		return null;
	}
	const total = progress.questions.length;
	return {
		title: progress.title,
		score: progress.score,
		total,
		marks: marks(progress),
		rank: rank(progress.score, total),
		points: progress.points || 0,
		dailyBonus: Boolean(progress.dailyBonus),
		limitReached: Boolean(progress.limitReached)
	};
}

async function getHistory(username) {
	return db.getHistory(username);
}

async function getResultDetail(resultId, username) {
	return db.getResultDetail(resultId, username);
}

// Quiz du jour de l'élève (un par professeur au plus)
async function getDailyQuizzes(username) {
	return db.getDailyQuizzes(dates.today(), username);
}

// ---------- Professeurs de l'élève ----------

async function getMyTeachers(username) {
	const [teachers, code] = await Promise.all([db.getTeachersOf(username), db.getLinkCode(username)]);
	return { teachers, code };
}

// Rejoindre un professeur grâce au code qu'il a généré (usage unique) ; renvoie son identifiant
async function joinTeacher(username, code) {
	const result = await db.useLinkCode(code, "admin", username);
	if (!result) {
		throw new Error("Aucun professeur ne correspond à ce code : il a peut-être expiré ou déjà servi. Demande un nouveau code à ton professeur.");
	}
	if (!result.linked) {
		throw new Error(`Tu es déjà un élève de ${result.owner}.`);
	}
	return result.owner;
}

async function leaveTeacher(username, teacher) {
	if (!(await db.unlinkStudent(teacher, username))) {
		throw new Error("Ce professeur n'est pas dans ta liste.");
	}
}

async function createMyCode(username, body) {
	return db.createLinkCode(username, linkDurations.parse(body));
}

module.exports = {
	getQuizzes,
	getDailyQuizzes,
	getMyTeachers,
	joinTeacher,
	leaveTeacher,
	createMyCode,
	getHistory,
	getResultDetail,
	startQuiz,
	getCurrentQuestion,
	submitAnswer,
	getResult
}
