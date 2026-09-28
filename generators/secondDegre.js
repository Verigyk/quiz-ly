const { randInt, randNonZero, pick, polyMul, polyFormat, fraction, fractionText, numberOption, textOption, range, delta } = require("./utils");

// Ensemble de racines « x = -2 ou x = 3 », ou « Aucune solution réelle »
function roots(values) {
	if (values.length === 0) {
		return textOption("Aucune solution réelle");
	}
	const sorted = [...values].sort((u, v) => u.n / u.d - v.n / v.d);
	const unique = sorted.filter((v, i) => i === 0 || v.n / v.d !== sorted[i - 1].n / sorted[i - 1].d);
	return {
		text: unique.map((v) => "x = " + fractionText(v)).join(" ou "),
		key: "s:" + unique.map((v) => v.n / v.d).join(",")
	};
}

const types = {
	discriminant: {
		label: "Calcul du discriminant Δ",
		generate(difficulty) {
			const a = range(difficulty, 1, randNonZero(-5, 5), randNonZero(-9, 9));
			const b = range(difficulty, randInt(1, 9), randNonZero(-9, 9), randNonZero(-15, 15));
			const c = range(difficulty, randInt(-9, 9), randNonZero(-9, 9), randNonZero(-15, 15));
			const disc = b * b - 4 * a * c;
			return {
				text: `Calculer le discriminant de ${polyFormat([c, b, a])}`,
				answer: numberOption(disc, `Δ = ${disc}`),
				traps: [
					numberOption(b * b + 4 * a * c, `Δ = ${b * b + 4 * a * c}`),
					numberOption(-b * b - 4 * a * c, `Δ = ${-b * b - 4 * a * c}`),
					numberOption(b - 4 * a * c, `Δ = ${b - 4 * a * c}`),
					numberOption(b * b - 2 * a * c, `Δ = ${b * b - 2 * a * c}`)
				],
				perturb: (spread) => {
					const d = disc + delta(spread);
					return numberOption(d, `Δ = ${d}`);
				}
			};
		}
	},

	racines: {
		label: "Résoudre ax² + bx + c = 0",
		generate(difficulty) {
			// Difficulté 3 : parfois aucune solution réelle ou une racine double
			if (difficulty === 3 && Math.random() < 0.4) {
				const a = randNonZero(-4, 4);
				if (Math.random() < 0.5) {
					const r = randInt(-6, 6);
					const poly = polyMul([a], polyMul([-r, 1], [-r, 1]));
					return {
						text: `Résoudre : ${polyFormat(poly)} = 0`,
						answer: roots([fraction(r, 1)]),
						traps: [roots([]), roots([fraction(-r, 1)]), roots([fraction(r, 1), fraction(-r, 1)])],
						perturb: (spread) => roots([fraction(r + delta(spread), 1)])
					};
				}
				const b = randInt(-4, 4);
				const c = Math.floor((b * b) / (4 * a)) + (a > 0 ? randInt(1, 6) : -randInt(1, 6));
				const disc = b * b - 4 * a * c;
				const fake = Math.sqrt(-disc);
				return {
					text: `Résoudre : ${polyFormat([c, b, a])} = 0`,
					answer: roots([]),
					traps: [
						roots([fraction(Math.round(-b - fake), 2 * a), fraction(Math.round(-b + fake), 2 * a)]),
						roots([fraction(-b, 2 * a)]),
						roots([fraction(b, 2 * a)])
					],
					perturb: (spread) => roots([fraction(randInt(-6, 6), 1), fraction(randInt(-6, 6), 1)])
				};
			}

			const a = range(difficulty, 1, randNonZero(-3, 3), randNonZero(-4, 4));
			let r1 = randInt(-7, 7), r2 = randInt(-7, 7);
			while (r1 === r2) r2 = randInt(-7, 7);
			const poly = polyMul([a], polyMul([-r1, 1], [-r2, 1]));
			const f = (n) => fraction(n, 1);
			return {
				text: `Résoudre : ${polyFormat(poly)} = 0`,
				answer: roots([f(r1), f(r2)]),
				traps: [
					// Signe de -b oublié, division par a au lieu de 2a, racines d'un facteur mal lu
					roots([f(-r1), f(-r2)]),
					roots([f(2 * r1), f(2 * r2)]),
					roots([f(r1), f(-r2)]),
					roots([fraction(r1, 2), fraction(r2, 2)])
				],
				perturb: (spread) => roots([f(r1 + delta(spread)), f(r2)])
			};
		}
	},

	sommet: {
		label: "Sommet de la parabole",
		generate(difficulty) {
			const a = range(difficulty, pick([1, -1]), randNonZero(-3, 3), randNonZero(-5, 5));
			const alpha = range(difficulty, randInt(-5, 5), randInt(-6, 6), randInt(-8, 8));
			const beta = randInt(-9, 9);
			// f(x) = a(x - α)² + β, affiché développé
			const poly = [a * alpha * alpha + beta, -2 * a * alpha, a];
			const f = (x) => a * x * x - 2 * a * alpha * x + a * alpha * alpha + beta;
			const point = (x, y) => textOption(`S(${x} ; ${y})`);
			return {
				text: `Donner les coordonnées du sommet de la parabole d'équation y = ${polyFormat(poly)}`,
				answer: point(alpha, beta),
				traps: [
					point(-alpha, beta),
					point(-alpha, f(-alpha)),
					point(2 * alpha, f(2 * alpha)),
					point(alpha, -beta)
				],
				perturb: (spread) => {
					const x = alpha + delta(spread);
					return point(x, f(x));
				}
			};
		}
	}
};

module.exports = {
	id: "second_degre",
	title: "Second degré",
	level: "Lycée (1re spé)",
	types
};
