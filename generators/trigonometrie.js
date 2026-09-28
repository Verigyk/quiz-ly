const { randInt, pick, textOption, range, gcd, delta } = require("./utils");

// Valeurs exactes de cos et sin aux angles multiples de π/6 et π/4 (en « 12e de π »)
const EXACT = {
	0: ["1", "0"], 2: ["√3/2", "1/2"], 3: ["√2/2", "√2/2"], 4: ["1/2", "√3/2"], 6: ["0", "1"]
};
const ALL_VALUES = ["0", "1/2", "√2/2", "√3/2", "1", "-1/2", "-√2/2", "-√3/2", "-1"];

// Angle k·π/12 réduit dans [0, 2π) -> [cos, sin] exacts
function exact(k) {
	const a = ((k % 24) + 24) % 24;
	const quarter = Math.floor(a / 6);
	const r = a % 6;
	let [c, s] = r === 0 ? EXACT[0] : EXACT[r];
	if (r === 0) {
		[c, s] = [["1", "0"], ["0", "1"], ["-1", "0"], ["0", "-1"]][quarter];
		return [c, s];
	}
	const neg = (v) => (v === "0" ? v : v.startsWith("-") ? v.slice(1) : "-" + v);
	// Rotation d'un quart de tour : (cos, sin) -> (-sin, cos)
	for (let i = 0; i < quarter; i++) {
		[c, s] = [neg(s), c];
	}
	return [c, s];
}

// Angle de référence dans [0, π/2] : l'erreur classique est d'oublier le signe du quadrant
function reference(k) {
	let a = ((k % 24) + 24) % 24 % 12;
	return a > 6 ? 12 - a : a;
}

// k·π/12 -> « 5π/6 », « -π/4 », « π »
function angleText(k) {
	if (k === 0) return "0";
	const g = gcd(k, 12);
	const n = k / g, d = 12 / g;
	const num = n === 1 ? "π" : n === -1 ? "-π" : `${n}π`;
	return d === 1 ? num : `${num}/${d}`;
}

const types = {
	valeurs_remarquables: {
		label: "Valeurs remarquables de cos et sin",
		generate(difficulty) {
			const base = [0, 2, 3, 4, 6];
			const k = range(
				difficulty,
				pick(base),
				pick([...base, 8, 9, 10, 12, 14, 15, 16, 18, 20, 21, 22]),
				pick([-2, -3, -4, -8, -9, -10, 26, 27, 28, 32, 34, 38, 40])
			);
			const fn = pick(["cos", "sin"]);
			const [c, s] = exact(k);
			const value = fn === "cos" ? c : s;
			const other = fn === "cos" ? s : c;
			const neg = (v) => (v === "0" ? "0" : v.startsWith("-") ? v.slice(1) : "-" + v);
			return {
				text: `Donner la valeur exacte de ${fn}(${angleText(k)})`,
				answer: textOption(value),
				// Pièges : confusion cos/sin, erreur de signe, angle de référence sans le quadrant
				traps: [textOption(other), textOption(neg(value)), textOption(neg(other)), textOption(exact(reference(k))[fn === "cos" ? 0 : 1])],
				perturb: (spread) => textOption(pick(ALL_VALUES))
			};
		}
	},

	conversion: {
		label: "Conversion degrés ↔ radians",
		generate(difficulty) {
			const k = range(difficulty, pick([2, 3, 4, 6, 12]), pick([8, 9, 10, 15, 16, 18, 20]), randInt(1, 23));
			const degrees = k * 15;
			return {
				text: `Convertir ${degrees}° en radians`,
				answer: textOption(angleText(k) + " rad"),
				traps: [
					textOption(angleText(24 - k) + " rad"),
					textOption(angleText(k * 2) + " rad"),
					textOption(`${degrees}π rad`),
					textOption(angleText(Math.max(1, Math.round(k / 2))) + " rad")
				],
				perturb: (spread) => textOption(angleText(k + delta(spread)) + " rad")
			};
		}
	}
};

module.exports = {
	id: "trigonometrie",
	title: "Trigonométrie (cercle trigonométrique)",
	level: "Lycée (2nde-1re)",
	types
};
