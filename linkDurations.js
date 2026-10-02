// Durées de validité proposées pour les codes d'association (usage unique dans tous les cas)
const dates = require("./dates");

const CHOICES = [
	{ id: "5m", label: "5 minutes", minutes: 5 },
	{ id: "1h", label: "1 heure", minutes: 60 },
	{ id: "5h", label: "5 heures", minutes: 5 * 60 },
	{ id: "10h", label: "10 heures", minutes: 10 * 60 },
	{ id: "24h", label: "24 heures", minutes: 24 * 60 },
	{ id: "7j", label: "1 semaine", minutes: 7 * 24 * 60 },
	{ id: "jamais", label: "Jamais (pas d'expiration)", minutes: null },
	{ id: "perso", label: "Jusqu'à une date…" }
];

const DEFAULT = "24h";

// Dates acceptées pour « jusqu'à une date » : d'aujourd'hui à dans un an
function dateRange() {
	const min = dates.today();
	return { min, max: dates.addDays(min, 365) };
}

// Durée choisie dans le formulaire → nombre de minutes, ou null pour « jamais ».
// Avec une date, le code reste valable jusqu'à la fin de ce jour-là (23 h 59).
function parse(body = {}) {
	const choice = CHOICES.find((c) => c.id === body.duration) || CHOICES.find((c) => c.id === DEFAULT);
	if (choice.id !== "perso") {
		return choice.minutes;
	}
	const { min, max } = dateRange();
	if (!dates.isISODate(body.date)) {
		throw new Error("Choisissez la date jusqu'à laquelle le code sera valable.");
	}
	if (body.date < min || body.date > max) {
		throw new Error("La date doit être comprise entre aujourd'hui et dans un an (choisissez « Jamais » pour un code sans expiration).");
	}
	const [y, m, d] = body.date.split("-").map(Number);
	const endOfDay = new Date(y, m - 1, d, 23, 59, 59);
	// Arrondi à la minute inférieure : le code finit à 23 h 59, pas quelques secondes après minuit
	return Math.max(1, Math.floor((endOfDay.getTime() - Date.now()) / 60000));
}

// Texte de l'expiration pour l'affichage
function describe(expiresAt) {
	if (!(expiresAt instanceof Date) || !Number.isFinite(expiresAt.getTime())) {
		return "sans date d'expiration";
	}
	return "valable jusqu'au " + expiresAt.toLocaleString("fr-FR", { dateStyle: "short", timeStyle: "short" });
}

module.exports = { CHOICES, DEFAULT, dateRange, parse, describe };
