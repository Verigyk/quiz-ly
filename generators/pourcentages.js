const { randInt, pick, formatNumber, numberOption, range, delta } = require("./utils");

function euros(value) {
	return numberOption(value, formatNumber(value) + " €");
}

// Taux d'évolution affiché avec son signe : « +12 % », « -4,5 % »
function rate(value) {
	const rounded = Math.round(value * 100) / 100;
	return numberOption(rounded, (rounded > 0 ? "+" : "") + formatNumber(rounded) + " %");
}

const types = {
	evolution: {
		label: "Appliquer une augmentation ou une réduction",
		generate(difficulty) {
			const price = range(difficulty, randInt(1, 10) * 20, randInt(4, 40) * 5, randInt(20, 400));
			const t = range(difficulty, pick([10, 20, 25, 50]), pick([5, 15, 30, 35, 40]), pick([3, 7, 12, 18, 45]));
			const up = Math.random() < 0.5;
			const s = up ? 1 : -1;
			const final = price * (1 + (s * t) / 100);

			if (difficulty === 3 && Math.random() < 0.5) {
				// Retrouver le prix initial : piège classique, appliquer l'évolution inverse
				return {
					text: `Après ${up ? "une augmentation" : "une réduction"} de ${t} %, un article coûte ${formatNumber(final)} €. Quel était son prix initial ?`,
					answer: euros(price),
					traps: [
						euros(final * (1 - (s * t) / 100)),
						euros(final - s * t),
						euros(final * (1 + (s * t) / 100))
					],
					perturb: (spread) => euros(price + delta(spread))
				};
			}

			return {
				text: `Un article coûte ${formatNumber(price)} €. Quel est son prix après ${up ? "une augmentation" : "une réduction"} de ${t} % ?`,
				answer: euros(final),
				traps: [
					euros(price + s * t),
					euros((price * t) / 100),
					euros(price * (1 - (s * t) / 100))
				],
				perturb: (spread) => euros(final + delta(spread))
			};
		}
	},

	coefficient: {
		label: "Coefficient multiplicateur",
		generate(difficulty) {
			const t = range(difficulty, pick([10, 20, 25, 50]), randInt(1, 19) * 5, randInt(1, 150) / (pick([1, 10])));
			const up = Math.random() < 0.5;
			const s = up ? 1 : -1;
			const coef = 1 + (s * t) / 100;
			if (!up && t >= 100) {
				return types.coefficient.generate(difficulty);
			}
			return {
				text: `${up ? "Augmenter" : "Diminuer"} une quantité de ${formatNumber(t)} % revient à la multiplier par :`,
				answer: numberOption(coef),
				traps: [
					numberOption(1 - (s * t) / 100),
					numberOption(t / 100),
					numberOption(s * t / 100),
					numberOption(t)
				],
				perturb: (spread) => numberOption(coef + delta(spread) / 100)
			};
		}
	},

	evolutions_successives: {
		label: "Évolutions successives",
		generate(difficulty) {
			const t1 = range(difficulty, pick([10, 20, 50]), randInt(1, 8) * 5, randInt(2, 60));
			const t2 = range(difficulty, pick([10, 20, 50]), randInt(1, 8) * 5, randInt(2, 60));
			const s1 = difficulty === 1 ? 1 : pick([1, -1]);
			const s2 = pick([1, -1]);
			const word = (s) => (s > 0 ? "une hausse" : "une baisse");
			const global = ((1 + (s1 * t1) / 100) * (1 + (s2 * t2) / 100) - 1) * 100;
			return {
				text: `Un prix subit ${word(s1)} de ${t1} % puis ${word(s2)} de ${t2} %. Quelle est l'évolution globale ?`,
				answer: rate(global),
				traps: [
					rate(s1 * t1 + s2 * t2),
					rate(s1 * t1 * s2 * t2 / 100),
					rate(-global),
					rate(s1 * t1 - s2 * t2)
				],
				perturb: (spread) => rate(global + delta(spread) / 2)
			};
		}
	}
};

module.exports = {
	id: "pourcentages",
	title: "Pourcentages et évolutions",
	level: "Collège (4e-3e) / 2nde",
	types
};
