// La plage : les compagnons d'une même classe se retrouvent et construisent chacun leur structure de sable
const path = require("node:path");
const ejs = require("ejs");
const db = require("../db");
const companion = require("../companion");

// Une structure par élève (toujours la même pour un élève donné)
const STRUCTURES = [
	{ id: "chateau", name: "Château de sable" },
	{ id: "pyramide", name: "Pyramide" },
	{ id: "tour", name: "Tour de sable" },
	{ id: "tortue", name: "Tortue de sable" },
	{ id: "serpent", name: "Serpent de mer" },
	{ id: "volcan", name: "Volcan de sable" }
];

// La structure grandit avec les quiz terminés : un niveau tous les QUIZZES_PER_LEVEL quiz, jusqu'au niveau MAX_LEVEL
const QUIZZES_PER_LEVEL = 3;
const MAX_LEVEL = 6;

function structureFor(username) {
	let hash = 0;
	for (const ch of username) hash = (hash * 31 + ch.codePointAt(0)) >>> 0;
	return STRUCTURES[hash % STRUCTURES.length];
}

const KID_TEMPLATE = path.join(__dirname, "..", "views", "partials", "kid.ejs");

// Personnages présents sur la plage, avec leur dessin (SVG) dans la pose de leur humeur
async function getScene(username, role) {
	const rows = await db.getBeachCharacters(username, role);
	return Promise.all(rows.map(async (row) => {
		const mood = companion.mood(row.happiness);
		const structure = structureFor(row.username);
		const level = Math.min(MAX_LEVEL, 1 + Math.floor(row.completed / QUIZZES_PER_LEVEL));
		return {
			id: row.username,
			owner: row.username,
			name: row.name,
			mood,
			moodLabel: companion.MOOD_LABELS[mood],
			happiness: row.happiness,
			isMe: row.username === username,
			structure: { type: structure.id, name: structure.name, level },
			nextLevelIn: level < MAX_LEVEL ? QUIZZES_PER_LEVEL - (row.completed % QUIZZES_PER_LEVEL) : 0,
			svg: await ejs.renderFile(KID_TEMPLATE, { mood, equipped: row.equipped || {} })
		};
	}));
}

module.exports = { getScene, STRUCTURES, QUIZZES_PER_LEVEL, MAX_LEVEL };
