const { randInt, pick, sup, range, delta } = require("./utils");

// Puissance « a⁵ », « 10⁻³ » ; deux options sont égales si elles ont le même exposant
function power(base, exponent) {
	const text = exponent === 1 ? base : exponent === 0 ? "1" : base + sup(exponent);
	return { text, key: "e:" + exponent };
}

// Exposants négatifs à partir de la difficulté 2
function randomExponent(difficulty) {
	return range(difficulty, randInt(2, 7), randInt(-6, 9) || 2, randInt(-12, 12) || -3);
}

function randomBase(difficulty) {
	return range(difficulty, pick(["a", "x"]), pick(["a", "x", "10"]), pick(["10", "a", "y"]));
}

const types = {
	produit: {
		label: "Produit de puissances aⁿ × aᵐ",
		generate(difficulty) {
			const base = randomBase(difficulty);
			const m = randomExponent(difficulty), n = randomExponent(difficulty);
			return {
				text: `Écrire sous la forme d'une seule puissance : ${base}${sup(m)} × ${base}${sup(n)}`,
				answer: power(base, m + n),
				traps: [power(base, m * n), power(base, m - n), power(base, n - m), power(base, m + n + 1)],
				perturb: (spread) => power(base, m + n + delta(spread))
			};
		}
	},

	quotient: {
		label: "Quotient de puissances aⁿ / aᵐ",
		generate(difficulty) {
			const base = randomBase(difficulty);
			const m = randomExponent(difficulty), n = randomExponent(difficulty);
			const traps = [power(base, n - m), power(base, m + n), power(base, m * n)];
			if (n !== 0 && m % n === 0) {
				traps.push(power(base, m / n));
			}
			return {
				text: `Écrire sous la forme d'une seule puissance : ${base}${sup(m)} / ${base}${sup(n)}`,
				answer: power(base, m - n),
				traps,
				perturb: (spread) => power(base, m - n + delta(spread))
			};
		}
	},

	puissance_de_puissance: {
		label: "Puissance de puissance (aⁿ)ᵐ",
		generate(difficulty) {
			const base = randomBase(difficulty);
			const m = range(difficulty, randInt(2, 5), randInt(-4, 6) || 2, randInt(-6, 6) || -2);
			const n = range(difficulty, randInt(2, 5), randInt(-4, 6) || 3, randInt(-6, 6) || 3);
			const traps = [power(base, m + n), power(base, m - n), power(base, -m * n)];
			if (m > 0 && n > 0 && m ** n <= 99) {
				traps.push(power(base, m ** n));
			}
			return {
				text: `Écrire sous la forme d'une seule puissance : (${base}${sup(m)})${sup(n)}`,
				answer: power(base, m * n),
				traps,
				perturb: (spread) => power(base, m * n + delta(spread))
			};
		}
	},

	mixte: {
		label: "Calcul combiné (aⁿ × aᵐ) / aᵖ",
		generate(difficulty) {
			const base = randomBase(Math.max(difficulty, 2));
			const m = randomExponent(difficulty), n = randomExponent(difficulty), p = randomExponent(difficulty);
			return {
				text: `Écrire sous la forme d'une seule puissance : (${base}${sup(m)} × ${base}${sup(n)}) / ${base}${sup(p)}`,
				answer: power(base, m + n - p),
				traps: [power(base, m * n - p), power(base, m + n + p), power(base, (m * n) / (p || 1)), power(base, m - n - p)]
					.filter((o) => Number.isInteger(Number(o.key.slice(2)))),
				perturb: (spread) => power(base, m + n - p + delta(spread))
			};
		}
	}
};

module.exports = {
	id: "puissances",
	title: "Puissances",
	level: "Collège (4e-3e)",
	types
};
