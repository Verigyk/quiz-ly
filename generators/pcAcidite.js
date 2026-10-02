const { randInt, pick, formatSig, numberOption, measureOption, sup, delta } = require("./utils");

const ph = (value) => numberOption(Math.round(value * 100) / 100, "pH = " + formatSig(Math.round(value * 100) / 100, 3));
const conc = (value) => measureOption(value, "mol·L⁻¹");

const types = {
	ph: {
		label: "pH à partir de [H₃O⁺]",
		generate(difficulty) {
			const k = randInt(1, 13);
			if (difficulty === 1) {
				return {
					text: `Une solution a une concentration [H₃O⁺] = 10${sup(-k)} mol·L⁻¹. Quel est son pH ?`,
					answer: ph(k),
					// Pièges : oublier le signe moins, confondre avec le pOH (14 - k)
					traps: [ph(-k), ph(14 - k)],
					perturb: (s) => ph(Math.max(0, k + delta(s)))
				};
			}
			const a = pick([2, 3, 5, 8]);
			const c = a * 10 ** -k;
			const value = -Math.log10(c);
			return {
				text: `Une solution a une concentration [H₃O⁺] = ${formatSig(c)} mol·L⁻¹. Quel est son pH ?`,
				answer: ph(value),
				traps: [ph(-value), ph(k), ph(14 - value)],
				perturb: (s) => ph(value + delta(s) * 0.3)
			};
		}
	},

	concentration_h3o: {
		label: "[H₃O⁺] à partir du pH",
		generate(difficulty) {
			const value = difficulty === 3 ? randInt(10, 130) / 10 : randInt(1, 13);
			const c = 10 ** -value;
			return {
				text: `Une solution a un pH de ${formatSig(value)}. Quelle est sa concentration en ions oxonium [H₃O⁺] ?`,
				// Pièges : oublier le signe moins, prendre le pH comme concentration, confondre avec [HO⁻]
				answer: conc(c),
				traps: [conc(10 ** value), conc(value), conc(10 ** -(14 - value))],
				perturb: (s) => conc(c * 10 ** delta(Math.min(3, s)))
			};
		}
	},

	nature: {
		label: "Solution acide, neutre ou basique (3 réponses au plus)",
		generate() {
			const value = pick([randInt(1, 6), 7, randInt(8, 13)]) + (Math.random() < 0.5 ? 0.5 : 0);
			const answer = value < 7 ? "acide" : value > 7 ? "basique" : "neutre";
			const t = (s) => ({ text: s, key: "t:" + s });
			return {
				text: `À 25 °C, une solution de pH = ${formatSig(value)} est :`,
				answer: t(answer),
				traps: ["acide", "neutre", "basique"].filter((x) => x !== answer).map(t),
				perturb: () => t(pick(["acide", "neutre", "basique"]))
			};
		}
	}
};

module.exports = { id: "pc_acidite", title: "Acides, bases et pH", level: "1re / Tle", subject: "Physique-chimie", types };
