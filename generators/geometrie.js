const { randInt, pick, shuffle, formatNumber, numberOption, textOption, range, delta } = require("./utils");

// Longueur exacte : entier si possible, sinon « √34 » ; la clé est la valeur numérique
function length(square) {
	if (square <= 0) {
		return null;
	}
	const root = Math.sqrt(square);
	const text = Number.isInteger(root) ? `${root} cm` : `√${square} cm`;
	return numberOption(root, text);
}

function cm(value) {
	return value > 0 ? numberOption(value, `${formatNumber(value)} cm`) : null;
}

const TRIPLES = [[3, 4, 5], [5, 12, 13], [8, 15, 17], [7, 24, 25], [20, 21, 29], [9, 40, 41]];

function triangleSides(difficulty) {
	if (difficulty === 3) {
		let a, b;
		do {
			a = randInt(2, 12);
			b = randInt(2, 12);
		} while (Number.isInteger(Math.sqrt(a * a + b * b)));
		return [a, b];
	}
	const [a, b] = difficulty === 1 ? [3, 4] : pick(TRIPLES);
	const k = difficulty === 1 ? randInt(1, 5) : randInt(1, 3);
	return shuffle([a * k, b * k]);
}

const types = {
	hypotenuse: {
		label: "Pythagore : calculer l'hypoténuse",
		generate(difficulty) {
			const [a, b] = triangleSides(difficulty);
			return {
				text: `ABC est rectangle en A avec AB = ${a} cm et AC = ${b} cm. Calculer BC.`,
				answer: length(a * a + b * b),
				traps: [
					cm(a + b),
					cm(a * a + b * b),
					length(Math.abs(b * b - a * a)),
					length(a + b)
				],
				perturb: (spread) => length(a * a + b * b + delta(spread))
			};
		}
	},

	cote: {
		label: "Pythagore : calculer un côté de l'angle droit",
		generate(difficulty) {
			const [a, b] = triangleSides(difficulty);
			const c2 = a * a + b * b;
			const c = Math.sqrt(c2);
			const cText = Number.isInteger(c) ? `${c} cm` : `√${c2} cm`;
			return {
				text: `ABC est rectangle en A avec BC = ${cText} et AB = ${a} cm. Calculer AC.`,
				answer: length(b * b),
				traps: [
					length(c2 + a * a),
					cm(Number.isInteger(c) ? c - a : 0),
					cm(c2 - a * a),
					length(c2 - a)
				],
				perturb: (spread) => length(b * b + delta(spread))
			};
		}
	},

	trigo_triangle: {
		label: "Trigonométrie dans le triangle rectangle",
		generate(difficulty) {
			// Triangle ABC rectangle en A : on demande le rapport sin, cos ou tan d'un angle
			const angle = difficulty === 1 ? "B" : pick(["B", "C"]);
			const fn = range(difficulty, pick(["cos", "sin"]), pick(["cos", "sin", "tan"]), pick(["cos", "sin", "tan"]));
			const other = angle === "B" ? "C" : "B";
			const adjacent = `A${angle}`, opposite = `A${other}`, hyp = "BC";
			const ratios = { cos: `${adjacent}/${hyp}`, sin: `${opposite}/${hyp}`, tan: `${opposite}/${adjacent}` };
			const all = [adjacent, opposite, hyp].flatMap((x) => [adjacent, opposite, hyp].filter((y) => y !== x).map((y) => `${x}/${y}`));
			return {
				text: `ABC est rectangle en A. Que vaut ${fn}(${angle}) ?`,
				answer: textOption(ratios[fn]),
				traps: [
					textOption(ratios[fn === "cos" ? "sin" : "cos"]),
					textOption(ratios[fn === "tan" ? "cos" : "tan"]),
					textOption(ratios[fn].split("/").reverse().join("/"))
				],
				perturb: (spread) => textOption(pick(all))
			};
		}
	}
};

module.exports = {
	id: "geometrie",
	title: "Pythagore et trigonométrie",
	level: "Collège (4e-3e)",
	types
};
