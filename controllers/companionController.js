const db = require("../db");
const companion = require("../companion");

const DAY = 24 * 60 * 60 * 1000;

// Charge le compagnon et applique le temps passé loin de lui :
// il perd un peu de bonheur par jour d'absence, et il est ravi quand l'élève revient.
async function load(username) {
	const row = await db.getCompanion(username);
	const daysAway = Math.floor((Date.now() - new Date(row.last_seen).getTime()) / DAY);
	let happiness = row.happiness;
	if (daysAway >= 1) {
		happiness = Math.max(0, happiness - companion.DAILY_DECAY * daysAway);
	}
	await db.updateCompanionPresence(username, happiness);

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
		missed: daysAway >= 1
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
