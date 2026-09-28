const { randInt, randNonZero, pick, gcd, polyMul, polyFormat, polyOption, linear, factoredOption, textOption, range, delta } = require("./utils");

// Petite modification d'un coefficient : réponse « presque juste »
function perturbPoly(coeffs, spread = 2) {
	const c = [...coeffs];
	const i = randInt(0, c.length - 1);
	c[i] = c[i] !== 0 && Math.random() < 0.2 ? -c[i] : c[i] + delta(spread);
	return polyOption(c);
}

function perturbFactors(k, factors, spread = 2) {
	const f = factors.map((x) => [...x]);
	const i = randInt(0, f.length - 1);
	f[i][1] = Math.random() < 0.2 ? -f[i][1] : f[i][1] + delta(spread);
	return factoredOption(k, f);
}

// k(ax + b) avec l'affichage « -3(2x - 5) »
function product(k, a, b) {
	return (k === -1 ? "-" : String(k)) + linear(a, b);
}

const types = {
	dev_simple: {
		label: "Développement simple k(ax + b)",
		generate(difficulty) {
			if (difficulty === 3) {
				// k(ax + b) - m(cx + d) : piège du signe devant la deuxième parenthèse
				const k = randNonZero(-6, 6), a = randNonZero(-5, 5), b = randNonZero(-9, 9);
				const m = randInt(2, 6), c = randNonZero(-5, 5), d = randNonZero(-9, 9);
				const correct = [k * b - m * d, k * a - m * c];
				return {
					text: `Développer et réduire : ${product(k, a, b)} - ${product(m, c, d)}`,
					answer: polyOption(correct),
					traps: [
						polyOption([k * b + m * d, k * a - m * c]),
						polyOption([k * b + m * d, k * a + m * c]),
						polyOption([k * b - d, k * a - m * c]),
						polyOption([k * b - m * d, k * a + m * c])
					],
					perturb: (spread) => perturbPoly(correct, spread)
				};
			}

			const k = difficulty === 1 ? randInt(2, 5) : randNonZero(-9, 9) || 2;
			const a = range(difficulty, randInt(1, 4), randNonZero(-5, 5));
			const b = range(difficulty, randInt(1, 9), randNonZero(-9, 9));
			const kk = Math.abs(k) === 1 ? 2 * k : k;
			const correct = [kk * b, kk * a];
			return {
				text: `Développer : ${product(kk, a, b)}`,
				answer: polyOption(correct),
				traps: [
					polyOption([b, kk * a]),
					polyOption([-kk * b, kk * a]),
					polyOption([kk + b, kk * a]),
					polyOption([kk * b, kk + a])
				],
				perturb: (spread) => perturbPoly(correct, spread)
			};
		}
	},

	dev_double: {
		label: "Double distributivité (ax + b)(cx + d)",
		generate(difficulty) {
			const a = range(difficulty, 1, randInt(1, 3), randNonZero(-5, 5));
			const c = range(difficulty, 1, randInt(1, 3), randNonZero(-5, 5));
			const b = range(difficulty, randInt(1, 9), randNonZero(-9, 9), randNonZero(-12, 12));
			const d = range(difficulty, randInt(1, 9), randNonZero(-9, 9), randNonZero(-12, 12));
			const correct = polyMul([b, a], [d, c]);
			return {
				text: `Développer et réduire : ${linear(a, b)}${linear(c, d)}`,
				answer: polyOption(correct),
				traps: [
					polyOption([b * d, 0, a * c]),
					polyOption([b * d, -(a * d + b * c), a * c]),
					polyOption([b * d, a * d, a * c]),
					polyOption([-b * d, a * d + b * c, a * c]),
					polyOption([b + d, a * d + b * c, a * c])
				],
				perturb: (spread) => perturbPoly(correct, spread)
			};
		}
	},

	id_somme: {
		label: "Identité remarquable (a + b)²",
		generate(difficulty) {
			const a = range(difficulty, 1, randInt(1, 5), randInt(2, 9));
			const b = range(difficulty, randInt(1, 9), randInt(1, 9), randInt(2, 12));
			const correct = [b * b, 2 * a * b, a * a];
			return {
				text: `Développer : ${linear(a, b)}²`,
				answer: polyOption(correct),
				traps: [
					polyOption([b * b, 0, a * a]),
					polyOption([b * b, a * b, a * a]),
					polyOption([b * b, 2 * a * b, a]),
					polyOption([2 * b, 2 * a * b, a * a])
				],
				perturb: (spread) => perturbPoly(correct, spread)
			};
		}
	},

	id_difference: {
		label: "Identité remarquable (a - b)²",
		generate(difficulty) {
			const a = range(difficulty, 1, randInt(1, 5), randInt(2, 9));
			const b = range(difficulty, randInt(1, 9), randInt(1, 9), randInt(2, 12));
			const correct = [b * b, -2 * a * b, a * a];
			return {
				text: `Développer : ${linear(a, -b)}²`,
				answer: polyOption(correct),
				traps: [
					polyOption([-b * b, 0, a * a]),
					polyOption([b * b, 2 * a * b, a * a]),
					polyOption([-b * b, -2 * a * b, a * a]),
					polyOption([b * b, -a * b, a * a]),
					polyOption([b * b, 0, a * a])
				],
				perturb: (spread) => perturbPoly(correct, spread)
			};
		}
	},

	id_produit: {
		label: "Identité remarquable (a + b)(a - b)",
		generate(difficulty) {
			const a = range(difficulty, 1, randInt(1, 5), randInt(2, 9));
			const b = range(difficulty, randInt(1, 9), randInt(1, 9), randInt(2, 12));
			const correct = [-b * b, 0, a * a];
			return {
				text: `Développer : ${linear(a, b)}${linear(a, -b)}`,
				answer: polyOption(correct),
				traps: [
					polyOption([b * b, 0, a * a]),
					polyOption([-b * b, -2 * a * b, a * a]),
					polyOption([-b * b, 0, a]),
					polyOption([-2 * b, 0, a * a])
				],
				perturb: (spread) => perturbPoly(correct, spread)
			};
		}
	},

	fact_commun: {
		label: "Factorisation par un facteur commun",
		generate(difficulty) {
			let a, b;
			do {
				a = randInt(1, 7);
				b = randNonZero(-9, 9);
			} while (gcd(a, b) !== 1);
			const k = range(difficulty, randInt(2, 6), randInt(2, 9), randInt(2, 7));

			if (difficulty === 3) {
				// kax² + kbx = kx(ax + b)
				const poly = [0, k * b, k * a];
				const kx = (inner) => `${k}x${inner}`;
				return {
					text: `Factoriser au maximum : ${polyFormat(poly)}`,
					answer: polyOption(poly, kx(linear(a, b))),
					traps: [
						// Factorisations incomplètes : égales, mais pas « au maximum »
						textOption(`x${linear(k * a, k * b)}`),
						textOption(`${k}(${polyFormat([0, b, a])})`),
						polyOption([0, k * k * b, k * a], kx(linear(a, k * b))),
						polyOption([0, -k * b, k * a], kx(linear(a, -b))),
						polyOption([0, k * b, k], kx(linear(1, b)))
					],
					perturb: (spread) => {
						const bb = Math.random() < 0.2 ? -b : b + delta(spread);
						return polyOption([0, k * bb, k * a], kx(linear(a, bb)));
					}
				};
			}

			const poly = [k * b, k * a];
			const traps = [
				polyOption([k * k * b, k * a], product(k, a, k * b)),
				polyOption([-k * b, k * a], product(k, a, -b)),
				polyOption([k * b, k * k * a], product(k, k * a, b))
			];
			// Factorisation incomplète : mathématiquement égale, mais pas « au maximum »
			const divisor = [2, 3, 5].find((p) => k % p === 0 && k !== p);
			if (divisor) {
				traps.push(textOption(product(divisor, (k / divisor) * a, (k / divisor) * b)));
			}
			return {
				text: `Factoriser au maximum : ${polyFormat(poly)}`,
				answer: polyOption(poly, product(k, a, b)),
				traps,
				perturb: (spread) => {
					const bb = Math.random() < 0.2 ? -b : b + delta(spread);
					return polyOption([k * bb, k * a], product(k, a, bb));
				}
			};
		}
	},

	fact_identite: {
		label: "Factorisation avec une identité remarquable",
		generate(difficulty) {
			const a = range(difficulty, 1, randInt(1, 4), randInt(2, 7));
			const b = range(difficulty, randInt(1, 9), randInt(1, 9), randInt(2, 11));
			const form = pick(["somme", "difference", "produit"]);

			const options = {
				somme: factoredOption(1, [[a, b], [a, b]]),
				difference: factoredOption(1, [[a, -b], [a, -b]]),
				produit: factoredOption(1, [[a, -b], [a, b]])
			};
			const polys = {
				somme: [b * b, 2 * a * b, a * a],
				difference: [b * b, -2 * a * b, a * a],
				produit: [-b * b, 0, a * a]
			};

			return {
				text: `Factoriser : ${polyFormat(polys[form])}`,
				answer: options[form],
				traps: [
					...Object.values(options).filter((o) => o !== options[form]),
					factoredOption(1, [[a, 2 * b], [a, 2 * b]]),
					factoredOption(1, [[a * a, -b], [a * a, b]]),
					factoredOption(1, [[a, -b * b], [a, b * b]])
				],
				perturb: (spread) => perturbFactors(1, [[a, form === "somme" ? b : -b], [a, form === "difference" ? -b : b]], spread)
			};
		}
	}
};

module.exports = {
	id: "calcul_litteral",
	title: "Calcul littéral : développer et factoriser",
	level: "Collège (4e-3e) / 2nde",
	types
};
