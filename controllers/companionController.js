const db = require("../db");
const companion = require("../companion");
const dates = require("../dates");

const DAY = 24 * 60 * 60 * 1000;

// Quiz du jour non terminés entre le lendemain de « after » et « until » (inclus), jours au format AAAA-MM-JJ
async function countMissedQuizzes(username, after, until) {
	let missed = 0;
	let day = dates.addDays(after, 1);
	const oldest = dates.addDays(until, 1 - companion.MAX_DAYS_CHECKED);
	if (day < oldest) day = oldest;
	for (; day <= until; day = dates.addDays(day, 1)) {
		const daily = await db.getDailyQuizzes(day, username);
		missed += daily.filter((q) => !q.done).length;
	}
	return missed;
}

// Charge le compagnon et applique ce qui s'est passé depuis la dernière visite :
// - il perd un peu de bonheur par jour d'absence, et il est ravi quand l'élève revient ;
// - il est triste pour chaque quiz du jour que l'élève n'a pas fait (vérifié une fois par jour).
async function load(username) {
	const row = await db.getCompanion(username);
	const daysAway = Math.floor((Date.now() - new Date(row.last_seen).getTime()) / DAY);
	let happiness = row.happiness;
	if (daysAway >= 1) {
		happiness = Math.max(0, happiness - companion.DAILY_DECAY * daysAway);
	}
	await db.updateCompanionPresence(username, happiness);

	const today = dates.today();
	const yesterday = dates.addDays(today, -1);
	let missedQuizzes = row.missed_on === today ? row.missed_quizzes : 0;
	if (row.checked_until < yesterday) {
		const missed = await countMissedQuizzes(username, row.checked_until, yesterday);
		if (missed > 0) {
			happiness = Math.max(0, happiness - companion.MISSED_QUIZ_PENALTY * missed);
			missedQuizzes = missed;
		}
		await db.updateCompanionMissed(username, happiness, yesterday, missedQuizzes, missed > 0 ? today : row.missed_on);
	}
	const pendingDaily = (await db.getDailyQuizzes(today, username)).some((q) => !q.done);

	const mood = companion.mood(happiness);
	return {
		name: row.name,
		happiness,
		mood,
		moodLabel: companion.MOOD_LABELS[mood],
		points: row.points,
		visible: row.visible,
		gifts: row.gifts,
		equipped: row.equipped || {},
		owned: row.owned || [],
		missed: daysAway >= 1,
		missedQuizzes,
		pendingDaily
	};
}

// Achat d'un objet : un cadeau est offert tout de suite, une tenue est ajoutée et portée
async function buy(username, itemId) {
	const item = companion.byId[itemId];
	if (!item) {
		throw new Error("Cet objet n'existe pas.");
	}
	if (item.kind === "cadeau") {
		if (!(await db.buyGift(username, item.price, item.joy))) {
			throw new Error("Pas assez de points pour cet objet… Encore quelques quiz !");
		}
		return { item, message: item.thanks };
	}

	const current = await db.getCompanion(username);
	if ((current.owned || []).includes(item.id)) {
		throw new Error("Tu as déjà cet objet.");
	}
	if (!(await db.buyItem(username, item.id, item.price))) {
		throw new Error("Pas assez de points pour cet objet… Encore quelques quiz !");
	}
	await db.equip(username, item.slot, item.id);
	return { item, message: `${item.name} ! Ça me va bien, non ?` };
}

// Porter une tenue achetée, ou la retirer
async function wear(username, itemId, on) {
	const item = companion.byId[itemId];
	if (!item || item.kind !== "tenue") {
		throw new Error("Cet objet n'existe pas.");
	}
	const current = await db.getCompanion(username);
	if (!(current.owned || []).includes(item.id)) {
		throw new Error("Tu n'as pas encore cet objet.");
	}
	await db.equip(username, item.slot, on ? item.id : null);
}

async function rename(username, name) {
	name = String(name || "").normalize("NFC").trim();
	if (name.length < 1 || name.length > 20) {
		throw new Error("Le prénom doit faire entre 1 et 20 caractères.");
	}
	await db.renameCompanion(username, name);
	return name;
}

async function setVisible(username, visible) {
	await db.setCompanionVisible(username, visible);
}

module.exports = {
	load,
	buy,
	wear,
	rename,
	setVisible,
	ITEMS: companion.ITEMS,
	SLOTS: companion.SLOTS,
	line: companion.line
};
