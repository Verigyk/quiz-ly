const { randInt, randNonZero, pick, gcd, fraction, fractionText, fractionOption, textOption, range, delta } = require("./utils");

// Fraction « a/b » sans forcément la simplifier (énoncé)
function raw(n, d) {
	return d === 1 ? String(n) : n < 0 ? `(-${-n}/${d})` : `${n}/${d}`;
}

// Fraction de l'énoncé, jamais égale à un entier (évite « 8/8 »)
function randomFraction(difficulty) {
	let n, d;
	do {
		d = range(difficulty, randInt(2, 6), randInt(2, 9), randInt(2, 12));
		n = range(difficulty, randInt(1, d + 3), randNonZero(-9, 9), randNonZero(-15, 15));
	} while (n % d === 0);
	return [n, d];
}

// Fraction différente pour éviter les cas triviaux
function otherDenominator(d, difficulty) {
	let e;
	do {
		e = range(difficulty, randInt(2, 6), randInt(2, 9), randInt(2, 12));
	} while (e === d);
	return e;
}

const types = {
	addition: {
		label: "Addition et soustraction de fractions",
		generate(difficulty) {
			const [a, b] = randomFraction(difficulty);
			const d = difficulty === 1 ? pick([b, otherDenominator(b, 1)]) : otherDenominator(b, difficulty);
			const c = range(difficulty, randInt(1, d + 3), randNonZero(-9, 9), randNonZero(-15, 15));
			const minus = difficulty === 3 && Math.random() < 0.5;
			const s = minus ? -1 : 1;
			return {
				text: `Calculer et simplifier : ${raw(a, b)} ${minus ? "-" : "+"} ${raw(c, d)}`,
				answer: fractionOption(a * d + s * c * b, b * d),
				traps: [
					fractionOption(a + s * c, b + d),
					fractionOption(a + s * c, b * d),
					fractionOption(a + s * c, b),
					fractionOption(a * d + s * c * b, b + d),
					fractionOption(a * d - s * c * b, b * d)
				],
				perturb: (spread) => fractionOption(a * d + s * c * b + delta(spread), b * d)
			};
		}
	},

	multiplication: {
		label: "Multiplication de fractions",
		generate(difficulty) {
			const [a, b] = randomFraction(difficulty);
			const [c, d] = randomFraction(difficulty);
			return {
				text: `Calculer et simplifier : ${raw(a, b)} × ${raw(c, d)}`,
				answer: fractionOption(a * c, b * d),
				traps: [
					fractionOption(a * d, b * c),
					fractionOption(a * c, b + d),
					fractionOption(a + c, b * d),
					fractionOption(a * d + b * c, b * d),
					fractionOption(-a * c, b * d)
				],
				perturb: (spread) => fractionOption(a * c + delta(spread), b * d)
			};
		}
	},

	division: {
		label: "Division de fractions",
		generate(difficulty) {
			const [a, b] = randomFraction(difficulty);
			let [c, d] = randomFraction(difficulty);
			if (c === 0) c = 1;
			return {
				text: `Calculer et simplifier : ${raw(a, b)} ÷ ${raw(c, d)}`,
				answer: fractionOption(a * d, b * c),
				traps: [
					fractionOption(a * c, b * d),
					fractionOption(b * c, a * d),
					fractionOption(a * b, c * d),
					fractionOption(-a * d, b * c)
				],
				perturb: (spread) => fractionOption(a * d + delta(spread), b * c)
			};
		}
	},

	simplification: {
		label: "Simplification de fraction",
		generate(difficulty) {
			let n, d;
			do {
				n = range(difficulty, randInt(1, 9), randInt(1, 15), randInt(2, 25));
				d = range(difficulty, randInt(2, 9), randInt(2, 15), randInt(3, 25));
			} while (gcd(n, d) !== 1 || n === d);
			const k = range(difficulty, pick([2, 3, 5]), pick([4, 6, 9, 10, 12]), pick([12, 15, 18, 24, 36]));
			const answer = fractionText(fraction(n, d));
			// La réponse et les pièges sont comparés sur le texte : une fraction non simplifiée est fausse ici
			const half = [2, 3, 5].find((p) => k % p === 0 && k !== p);
			return {
				text: `Simplifier au maximum : ${n * k}/${d * k}`,
				answer: textOption(answer),
				traps: [
					half ? textOption(`${(n * k) / half}/${(d * k) / half}`) : null,
					textOption(`${d}/${n}`),
					textOption(`${n * k - k}/${d * k - k}`),
					textOption(`${n}/${d * k}`),
					textOption(`${n * k}/${d}`)
				],
				perturb: (spread) => textOption(`${n + delta(spread)}/${d}`)
			};
		}
	}
};

module.exports = {
	id: "fractions",
	title: "Fractions",
	level: "Collège (5e-4e)",
	types
};
