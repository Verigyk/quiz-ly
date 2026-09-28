const { randInt, randNonZero, pick, formatNumber, numberOption, range, delta } = require("./utils");

const SUBSCRIPTS = "₀₁₂₃₄₅₆₇₈₉";
function u(n) {
	return "u" + String(n).split("").map((c) => SUBSCRIPTS[c]).join("");
}

const option = (x) => numberOption(x, formatNumber(x));

const types = {
	arithmetique: {
		label: "Suite arithmétique : calculer un terme",
		generate(difficulty) {
			const u0 = randInt(-20, 20);
			const r = range(difficulty, randInt(1, 9), randNonZero(-9, 9), randNonZero(-15, 15));
			const n = range(difficulty, randInt(5, 12), randInt(10, 30), randInt(20, 100));

			if (difficulty === 3 && Math.random() < 0.5) {
				// Retrouver le premier terme u₁ donné, calculer uₙ : piège du décalage d'indice
				const u1 = u0 + r;
				return {
					text: `(uₙ) est arithmétique de raison ${r} avec ${u(1)} = ${u1}. Calculer ${u(n)}.`,
					answer: option(u1 + (n - 1) * r),
					traps: [option(u1 + n * r), option(u1 + (n + 1) * r), option(u1 + n + r), option(u1 - (n - 1) * r)],
					perturb: (spread) => option(u1 + (n - 1) * r + delta(spread))
				};
			}

			return {
				text: `(uₙ) est arithmétique de premier terme ${u(0)} = ${u0} et de raison ${r}. Calculer ${u(n)}.`,
				answer: option(u0 + n * r),
				traps: [option(u0 + (n - 1) * r), option(u0 + (n + 1) * r), option(u0 + n + r), option(u0 * r * n)],
				perturb: (spread) => option(u0 + n * r + delta(spread))
			};
		}
	},

	geometrique: {
		label: "Suite géométrique : calculer un terme",
		generate(difficulty) {
			const u0 = range(difficulty, randInt(1, 5), randNonZero(-5, 5), randNonZero(-8, 8));
			const q = range(difficulty, randInt(2, 3), pick([2, 3, -2]), pick([2, -2, 3, -3, 0.5]));
			const n = range(difficulty, randInt(2, 5), randInt(3, 6), randInt(3, 7));
			return {
				text: `(uₙ) est géométrique de premier terme ${u(0)} = ${u0} et de raison ${formatNumber(q)}. Calculer ${u(n)}.`,
				answer: option(u0 * q ** n),
				traps: [option(u0 * q ** (n - 1)), option(u0 * q ** (n + 1)), option(u0 * q * n), option(u0 + q ** n), option((u0 * q) ** n)],
				perturb: (spread) => option(u0 * q ** n + delta(spread))
			};
		}
	},

	raison: {
		label: "Retrouver la raison d'une suite arithmétique",
		generate(difficulty) {
			const r = range(difficulty, randInt(1, 9), randNonZero(-9, 9), randNonZero(-15, 15));
			const p = randInt(0, 6);
			const q = p + range(difficulty, randInt(1, 4), randInt(2, 8), randInt(3, 12));
			const up = randInt(-20, 20);
			const uq = up + (q - p) * r;
			return {
				text: `(uₙ) est arithmétique avec ${u(p)} = ${up} et ${u(q)} = ${uq}. Quelle est sa raison ?`,
				answer: option(r),
				traps: [
					option(Math.round(((uq - up) / q) * 100) / 100),
					option(uq - up),
					option(-r),
					option(Math.round(((uq - up) / (q - p + 1)) * 100) / 100)
				],
				perturb: (spread) => option(r + delta(spread))
			};
		}
	}
};

module.exports = {
	id: "suites",
	title: "Suites arithmétiques et géométriques",
	level: "Lycée (1re)",
	types
};
