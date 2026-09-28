const { randInt, pick, shuffle, formatNumber, numberOption, range, delta } = require("./utils");

function series(difficulty) {
	const size = range(difficulty, randInt(4, 5), randInt(5, 8), randInt(7, 10));
	const max = range(difficulty, 10, 20, 50);
	return Array.from({ length: size }, () => randInt(0, max));
}

function median(values) {
	const sorted = [...values].sort((a, b) => a - b);
	const mid = Math.floor(sorted.length / 2);
	return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

const round2 = (x) => Math.round(x * 100) / 100;
const option = (x) => numberOption(round2(x), formatNumber(round2(x)));

const types = {
	moyenne: {
		label: "Moyenne d'une série",
		generate(difficulty) {
			const values = series(difficulty);
			const sum = values.reduce((a, b) => a + b, 0);
			return {
				text: `Calculer la moyenne de la série : ${values.join(" ; ")} (arrondie au centième)`,
				answer: option(sum / values.length),
				traps: [
					option(median(values)),
					option(sum / (values.length - 1)),
					option((Math.min(...values) + Math.max(...values)) / 2),
					option(sum / (values.length + 1))
				],
				perturb: (spread) => option(sum / values.length + delta(spread) / 2)
			};
		}
	},

	moyenne_ponderee: {
		label: "Moyenne pondérée (coefficients)",
		generate(difficulty) {
			const count = range(difficulty, 3, 4, 5);
			const notes = Array.from({ length: count }, () => randInt(4, 20));
			const coefs = Array.from({ length: count }, () => randInt(1, range(difficulty, 3, 4, 6)));
			const total = notes.reduce((s, n, i) => s + n * coefs[i], 0);
			const weights = coefs.reduce((a, b) => a + b, 0);
			const detail = notes.map((n, i) => `${n} (coef. ${coefs[i]})`).join(", ");
			return {
				text: `Calculer la moyenne pondérée des notes : ${detail} (arrondie au centième)`,
				answer: option(total / weights),
				traps: [
					option(notes.reduce((a, b) => a + b, 0) / count),
					option(total / count),
					option(total / (weights + 1))
				],
				perturb: (spread) => option(total / weights + delta(spread) / 2)
			};
		}
	},

	mediane: {
		label: "Médiane d'une série",
		generate(difficulty) {
			const values = shuffle(series(difficulty));
			const sorted = [...values].sort((a, b) => a - b);
			const sum = values.reduce((a, b) => a + b, 0);
			return {
				text: `Déterminer la médiane de la série : ${values.join(" ; ")}`,
				answer: option(median(values)),
				// Pièges : prendre la valeur du milieu sans trier, la moyenne, la moyenne des extrêmes
				traps: [
					option(values[Math.floor(values.length / 2)]),
					option(sum / values.length),
					option((sorted[0] + sorted[sorted.length - 1]) / 2),
					option(sorted[Math.floor(sorted.length / 2) - 1])
				],
				perturb: (spread) => option(median(values) + delta(spread))
			};
		}
	},

	etendue: {
		label: "Étendue d'une série",
		generate(difficulty) {
			const values = series(difficulty);
			const min = Math.min(...values), max = Math.max(...values);
			return {
				text: `Calculer l'étendue de la série : ${values.join(" ; ")}`,
				answer: option(max - min),
				traps: [option(max), option(max + min), option(values[values.length - 1] - values[0])],
				perturb: (spread) => option(max - min + delta(spread))
			};
		}
	}
};

module.exports = {
	id: "statistiques",
	title: "Statistiques",
	level: "Collège (5e-3e)",
	types
};
