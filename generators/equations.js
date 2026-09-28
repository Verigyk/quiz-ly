const { randInt, randNonZero, pick, polyFormat, linear, fraction, fractionText, fractionOption, textOption, range, delta } = require("./utils");

// Solution d'une équation : « x = 3/2 »
function solution(n, d) {
	const option = fractionOption(n, d);
	return option && { text: "x = " + option.text, key: option.key };
}

// Ensemble de solutions « x = -2 ou x = 3 » ; la clé ne dépend pas de l'ordre
function solutions(values) {
	const sorted = [...values].sort((u, v) => u.n / u.d - v.n / v.d);
	const unique = sorted.filter((v, i) => i === 0 || v.n / v.d !== sorted[i - 1].n / sorted[i - 1].d);
	return {
		text: unique.map((v) => "x = " + fractionText(v)).join(" ou "),
		key: "s:" + unique.map((v) => v.n / v.d).join(",")
	};
}

const types = {
	premier_degre: {
		label: "Équation du 1er degré",
		generate(difficulty) {
			if (difficulty === 3) {
				// ax + b = cx + d, solution pas forcément entière
				let a, c;
				do {
					a = randNonZero(-9, 9);
					c = randNonZero(-9, 9);
				} while (a === c);
				const b = randNonZero(-15, 15), d = randNonZero(-15, 15);
				return {
					text: `Résoudre : ${polyFormat([b, a])} = ${polyFormat([d, c])}`,
					answer: solution(d - b, a - c),
					traps: [
						solution(d - b, a + c),
						solution(d + b, a - c),
						solution(b - d, a - c),
						solution(a - c, d - b)
					],
					perturb: (spread) => solution(d - b + delta(spread), a - c)
				};
			}

			const a = range(difficulty, randInt(2, 9), randNonZero(-9, 9));
			const x0 = range(difficulty, randInt(1, 10), randInt(-10, 10));
			const b = range(difficulty, randInt(1, 20), randNonZero(-20, 20));
			const aa = Math.abs(a) === 1 ? 2 * a : a;
			const cc = aa * x0 + b;
			return {
				text: `Résoudre : ${polyFormat([b, aa])} = ${cc}`,
				answer: solution(cc - b, aa),
				traps: [
					solution(cc + b, aa),
					solution(cc - b, -aa),
					solution(aa, cc - b),
					solution(cc - b - aa, 1),
					solution(cc - b * aa, aa)
				].filter(Boolean),
				perturb: (spread) => solution(cc - b + delta(spread), aa)
			};
		}
	},

	produit_nul: {
		label: "Équation produit nul",
		generate(difficulty) {
			const a = range(difficulty, 1, randInt(1, 3), randInt(2, 5));
			const c = range(difficulty, 1, randInt(1, 3), randInt(2, 5));
			const b = randNonZero(-9, 9), d = randNonZero(-9, 9);
			const r = (p, q) => fraction(p, q);
			return {
				text: `Résoudre : ${linear(a, b)}${linear(c, d)} = 0`,
				answer: solutions([r(-b, a), r(-d, c)]),
				traps: [
					solutions([r(b, a), r(d, c)]),
					solutions([r(-b, a), r(d, c)]),
					solutions([r(-a, b), r(-c, d)]),
					solutions([r(-b, 1), r(-d, 1)])
				],
				perturb: (spread) => solutions([r(-b + delta(spread), a), r(-d, c)])
			};
		}
	},

	inequation: {
		label: "Inéquation du 1er degré",
		generate(difficulty) {
			// Difficulté 2 et 3 : coefficient négatif, piège du changement de sens
			const a = range(difficulty, randInt(2, 9), -randInt(2, 9), randNonZero(-9, 9));
			const b = randNonZero(-15, 15);
			const c = randInt(-20, 20);
			const symbol = pick(["<", ">", "≤", "≥"]);
			const flip = { "<": ">", ">": "<", "≤": "≥", "≥": "≤" };
			const value = fractionOption(c - b, a);
			const wrongValue = fractionOption(c + b, a);
			const option = (s, v) => textOption(`x ${s} ${v.text}`);
			const correctSymbol = a < 0 ? flip[symbol] : symbol;
			return {
				text: `Résoudre : ${polyFormat([b, a])} ${symbol} ${c}`,
				answer: option(correctSymbol, value),
				traps: [
					option(flip[correctSymbol], value),
					option(correctSymbol, wrongValue),
					option(flip[correctSymbol], wrongValue)
				],
				perturb: (spread) => option(pick([correctSymbol, flip[correctSymbol]]), fractionOption(c - b + delta(spread), a))
			};
		}
	}
};

module.exports = {
	id: "equations",
	title: "Équations et inéquations",
	level: "Collège (4e-3e) / 2nde",
	types
};
