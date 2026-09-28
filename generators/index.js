// Moteur de génération des quiz de maths à partir d'une configuration
const { shuffle } = require("./utils");

const chapters = [
	require("./calculLitteral"),
	require("./equations"),
	require("./fractions"),
	require("./puissances"),
	require("./pourcentages"),
	require("./geometrie"),
	require("./statistiques"),
	require("./secondDegre"),
	require("./derivees"),
	require("./suites"),
	require("./trigonometrie")
];

const byId = Object.fromEntries(chapters.map((c) => [c.id, c]));

const LIMITS = {
	questionCount: [1, 50],
	choiceCount: [2, 6],
	items: 20,
	weight: [1, 10]
};

// Modes de construction des mauvaises réponses
const TRAP_MODES = {
	pieges: "Pièges : erreurs classiques en priorité",
	mixte: "Mixte : moitié pièges, moitié réponses proches",
	proches: "Réponses proches seulement (pas de pièges ciblés)"
};

// Liste des chapitres et types pour le formulaire de création, avec un exemple de question
function catalog() {
	return chapters.map((chapter) => ({
		id: chapter.id,
		title: chapter.title,
		level: chapter.level,
		types: Object.entries(chapter.types).map(([id, type]) => ({
			id,
			label: type.label,
			example: type.generate(2).text
		}))
	}));
}

// Question à choix multiples : { text, choices, answer (index), chapter, type, difficulty }
function buildQuestion(item, choiceCount, trapMode) {
	const type = byId[item.chapter].types[item.type];
	const q = type.generate(item.difficulty);

	const wrong = [];
	const keys = new Set([q.answer.key]);
	const texts = new Set([q.answer.text]);
	const add = (option) => {
		if (!option || keys.has(option.key) || texts.has(option.text) || wrong.length >= choiceCount - 1) {
			return;
		}
		if (/NaN|Infinity|undefined/.test(option.text)) {
			return;
		}
		keys.add(option.key);
		texts.add(option.text);
		wrong.push(option);
	};

	const trapBudget = { pieges: choiceCount - 1, mixte: Math.ceil((choiceCount - 1) / 2), proches: 0 }[trapMode];
	shuffle(q.traps.filter(Boolean)).slice(0, trapBudget * 2).forEach((option) => {
		if (wrong.length < trapBudget) add(option);
	});
	for (let tries = 0; wrong.length < choiceCount - 1 && tries < 200; tries++) {
		add(q.perturb(2 + Math.floor(tries / 20)));
	}

	const choices = shuffle([q.answer, ...wrong]);
	return {
		text: q.text,
		choices: choices.map((c) => c.text),
		answer: choices.indexOf(q.answer),
		chapter: item.chapter,
		type: item.type,
		difficulty: item.difficulty
	};
}

// Répartit le nombre de questions selon les fréquences (méthode du plus grand reste)
function distribute(items, total) {
	const weightSum = items.reduce((s, it) => s + it.weight, 0);
	const exact = items.map((it) => (it.weight / weightSum) * total);
	const counts = exact.map(Math.floor);
	let remaining = total - counts.reduce((a, b) => a + b, 0);
	exact
		.map((x, i) => ({ i, rest: x - Math.floor(x) }))
		.sort((a, b) => b.rest - a.rest)
		.forEach(({ i }) => {
			if (remaining > 0) {
				counts[i]++;
				remaining--;
			}
		});
	return counts;
}

// Génère toutes les questions d'un quiz à partir de sa configuration
function generateQuiz(config) {
	const counts = distribute(config.items, config.questionCount);
	const seen = new Set();
	const questions = [];

	config.items.forEach((item, i) => {
		for (let n = 0; n < counts[i]; n++) {
			let question;
			// Évite deux questions identiques dans le même quiz
			for (let tries = 0; tries < 20; tries++) {
				question = buildQuestion(item, config.choiceCount, config.trapMode);
				if (!seen.has(question.text)) break;
			}
			seen.add(question.text);
			questions.push(question);
		}
	});

	return config.order === "groupe" ? questions : shuffle(questions);
}

function clampInt(value, [min, max], name) {
	const n = Number(value);
	if (!Number.isInteger(n) || n < min || n > max) {
		throw new Error(`${name} doit être un entier entre ${min} et ${max}.`);
	}
	return n;
}

// Vérifie et nettoie une configuration envoyée par le formulaire ; lève une erreur lisible sinon
function normalizeConfig(raw) {
	if (!raw || typeof raw !== "object") {
		throw new Error("Configuration invalide.");
	}
	const title = String(raw.title || "").trim();
	if (!title || title.length > 100) {
		throw new Error("Le titre est obligatoire (100 caractères maximum).");
	}
	if (!Array.isArray(raw.items) || raw.items.length === 0 || raw.items.length > LIMITS.items) {
		throw new Error(`Ajoutez entre 1 et ${LIMITS.items} types de questions.`);
	}

	const items = raw.items.map((it, i) => {
		const chapter = byId[it.chapter];
		if (!chapter || !chapter.types[it.type]) {
			throw new Error(`Type de question inconnu (ligne ${i + 1}).`);
		}
		return {
			chapter: it.chapter,
			type: it.type,
			difficulty: clampInt(it.difficulty, [1, 3], "La difficulté"),
			weight: clampInt(it.weight, LIMITS.weight, "La fréquence")
		};
	});

	if (!(raw.trapMode in TRAP_MODES)) {
		throw new Error("Mode de pièges inconnu.");
	}

	return {
		title,
		description: String(raw.description || "").trim().slice(0, 500),
		questionCount: clampInt(raw.questionCount, LIMITS.questionCount, "Le nombre de questions"),
		choiceCount: clampInt(raw.choiceCount, LIMITS.choiceCount, "Le nombre de réponses"),
		trapMode: raw.trapMode,
		order: raw.order === "groupe" ? "groupe" : "melange",
		regenerate: raw.regenerate !== false,
		items
	};
}

module.exports = {
	catalog,
	generateQuiz,
	normalizeConfig,
	TRAP_MODES,
	LIMITS
};
