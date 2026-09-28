// Dates au format « AAAA-MM-JJ », calculées dans le fuseau horaire du serveur

function toISO(date) {
	const pad = (n) => String(n).padStart(2, "0");
	return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function fromISO(iso) {
	const [y, m, d] = iso.split("-").map(Number);
	return new Date(y, m - 1, d);
}

function isISODate(value) {
	return typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value) && toISO(fromISO(value)) === value;
}

function today() {
	return toISO(new Date());
}

function addDays(iso, days) {
	const date = fromISO(iso);
	date.setDate(date.getDate() + days);
	return toISO(date);
}

// Lundi de la semaine qui contient cette date
function mondayOf(iso) {
	const day = fromISO(iso).getDay(); // 0 = dimanche
	return addDays(iso, day === 0 ? -6 : 1 - day);
}

// « lundi 29 septembre »
function label(iso) {
	return fromISO(iso).toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" });
}

module.exports = { today, addDays, mondayOf, label, isISODate };
