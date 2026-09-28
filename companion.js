// Le compagnon de l'élève : boutique, humeur et petites phrases

// Cadeaux : utilisés tout de suite, ils rendent l'enfant plus heureux.
// Tenues : achetées une fois, l'élève choisit laquelle porter (une par emplacement).
const ITEMS = [
	{ id: "gouter", kind: "cadeau", name: "Goûter", icon: "🍪", price: 20, joy: 10, thanks: "Miam ! J'avais justement un petit creux. Merci !" },
	{ id: "dessin", kind: "cadeau", name: "Boîte de feutres", icon: "🖍️", price: 35, joy: 12, thanks: "Je vais te dessiner un dragon. Promis, il sera gentil !" },
	{ id: "chocolat", kind: "cadeau", name: "Chocolat chaud", icon: "☕", price: 30, joy: 15, thanks: "Tout chaud… ça réchauffe jusqu'aux orteils !" },
	{ id: "ballon", kind: "cadeau", name: "Ballon", icon: "⚽", price: 40, joy: 15, thanks: "Un ballon ! On fait une partie après ton quiz ?" },
	{ id: "livre", kind: "cadeau", name: "Livre d'aventures", icon: "📚", price: 50, joy: 20, thanks: "Des pirates ET des maths ? Mon livre préféré !" },
	{ id: "jeu", kind: "cadeau", name: "Jeu de société", icon: "🎲", price: 60, joy: 25, thanks: "On y joue ensemble ? Je compte les points, je suis super fort·e maintenant !" },
	{ id: "doudou", kind: "cadeau", name: "Doudou lapin", icon: "🐰", price: 80, joy: 35, thanks: "Il est tout doux… Je vais l'appeler Pi. Merci, vraiment !" },

	{ id: "casquette", kind: "tenue", slot: "tete", name: "Casquette", icon: "🧢", price: 60 },
	{ id: "bonnet", kind: "tenue", slot: "tete", name: "Bonnet à pompon", icon: "🎿", price: 70 },
	{ id: "couronne", kind: "tenue", slot: "tete", name: "Couronne en papier", icon: "👑", price: 90 },
	{ id: "echarpe", kind: "tenue", slot: "cou", name: "Écharpe", icon: "🧣", price: 50 },
	{ id: "lunettes", kind: "tenue", slot: "yeux", name: "Lunettes étoiles", icon: "🤩", price: 80 },
	{ id: "cape", kind: "tenue", slot: "dos", name: "Cape de super-héros", icon: "🦸", price: 120 },
	{ id: "chat", kind: "tenue", slot: "ami", name: "Chaton", icon: "🐱", price: 150 }
];

const byId = Object.fromEntries(ITEMS.map((item) => [item.id, item]));

const SLOTS = { tete: "Tête", cou: "Cou", yeux: "Yeux", dos: "Dos", ami: "Compagnon" };

const DAILY_DECAY = 10; // bonheur perdu par jour d'absence
const QUIZ_JOY = 5; // bonheur gagné quand l'élève termine un quiz

function mood(happiness) {
	if (happiness < 35) return "triste";
	if (happiness < 70) return "calme";
	return "heureux";
}

const MOOD_LABELS = { triste: "Un peu triste", calme: "Tranquille", heureux: "Très heureux·se" };

// Points gagnés en terminant un quiz
function quizPoints(score, total, isDailyFirst) {
	return score * 10 + (score === total ? 20 : 0) + (isDailyFirst ? 15 : 0);
}

const MAX_REWARDED_PER_DAY = 3;

// ---------- Phrases ----------

const LINES = {
	missed: [
		"Te revoilà !! Tu m'as trop manqué !",
		"C'est toi ! Je t'attendais depuis des jours…",
		"Enfin ! Je commençais à me sentir bien seul·e…"
	],
	accueil: {
		triste: ["Je me sens un peu seul·e aujourd'hui…", "Tu restes un peu avec moi ?", "Un petit quiz ensemble ? Ça me changerait les idées."],
		calme: ["On fait un quiz ?", "J'ai hâte de voir ce que tu vas apprendre aujourd'hui !", "Tu sais que je compte sur toi ?"],
		heureux: ["Aujourd'hui, on va tout déchirer !", "Je suis tellement content·e de te voir !", "Allez, on se lance ? Je suis prêt·e !"]
	},
	quiz: {
		triste: ["Je suis là, prends ton temps…", "On y va doucement, d'accord ?"],
		calme: ["Lis bien la question jusqu'au bout !", "Attention aux pièges…", "Tu peux le faire !"],
		heureux: ["Allez, allez !", "Je crois en toi !", "Celle-là, elle est pour toi !"]
	},
	correct: ["Ouais !! Trop fort !", "Bien joué !!", "Je le savais !", "Encore une !"],
	wrong: ["Pas grave, on apprend comme ça !", "Oups ! La prochaine sera la bonne.", "C'était un piège, pas de souci !"],
	resultat: {
		bon: ["Je suis trop fier·e de toi !", "Tu as vu ça ?! Quel score !", "On fête ça ?"],
		moyen: ["Bien joué ! On réessaie pour faire encore mieux ?", "Tu progresses, je le vois !"],
		faible: ["C'est en se trompant qu'on apprend. Je reste avec toi !", "On regarde la correction ensemble ?"]
	},
	historique: ["Regarde tout ce que tu as déjà fait !", "On relit les erreurs ? C'est comme ça qu'on progresse."],
	boutique: ["Oh… qu'est-ce que tu vas choisir ?", "Tu as gagné tous ces points ? Waouh !"]
};

function pick(list) {
	return list[Math.floor(Math.random() * list.length)];
}

// Phrase du compagnon selon la page, son humeur et ce qui vient de se passer
function line(companion, context, event = {}) {
	if (companion.missed && context === "accueil") return pick(LINES.missed);
	if (event.correct === true) return pick(LINES.correct);
	if (event.correct === false) return pick(LINES.wrong);
	if (context === "resultat") {
		const ratio = event.total ? event.score / event.total : 0;
		return pick(LINES.resultat[ratio >= 0.8 ? "bon" : ratio >= 0.5 ? "moyen" : "faible"]);
	}
	const byMood = LINES[context];
	if (!byMood) return pick(LINES.accueil[companion.mood]);
	return pick(Array.isArray(byMood) ? byMood : byMood[companion.mood]);
}

module.exports = {
	ITEMS,
	byId,
	SLOTS,
	DAILY_DECAY,
	QUIZ_JOY,
	MAX_REWARDED_PER_DAY,
	MOOD_LABELS,
	mood,
	quizPoints,
	line
};
