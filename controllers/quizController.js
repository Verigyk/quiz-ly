const db = require("../db");
const generators = require("../generators");
const dates = require("../dates");
const companion = require("../companion");

async function getQuizzes() {
	return db.getQuizzes();
}

// Questions d'une tentative : générées à la volée, ou enregistrées (quiz manuel ou figé)
function questionsFor(quiz) {
	if (quiz.config && quiz.config.regenerate) {
		return generators.generateQuiz(quiz.config).map(({ text, choices, answer }) => ({ text, choices, answer }));
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
	const questions = questionsFor(quiz);
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
			db.getDailyQuiz(dates.today(), session.username)
		]);
		const isDailyFirst = Boolean(daily && daily.id === progress.id && !daily.done);
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

async function getDailyQuiz(username) {
	return db.getDailyQuiz(dates.today(), username);
}

module.exports = {
	getQuizzes,
	getDailyQuiz,
	getHistory,
	getResultDetail,
	startQuiz,
	getCurrentQuestion,
	submitAnswer,
	getResult
}
