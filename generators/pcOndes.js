const { randInt, pick, formatSig, measureOption, delta } = require("./utils");

const V_SON = 340, C_LUMIERE = 3e8;
const near = (value, unit, spread) => measureOption(value * (1 + delta(spread) * 0.12), unit);

const types = {
	longueur_onde: {
		label: "Longueur d'onde λ = v / f",
		generate(difficulty) {
			if (difficulty === 3) {
				// Onde lumineuse : grandes fréquences, puissances de 10
				const lambdaNm = pick([400, 450, 500, 550, 600, 650, 700]);
				const f = C_LUMIERE / (lambdaNm * 1e-9);
				return {
					text: `Une radiation lumineuse a une fréquence de ${formatSig(f)} Hz. Quelle est sa longueur d'onde dans le vide (c = 3,00 × 10⁸ m·s⁻¹) ?`,
					answer: measureOption(lambdaNm * 1e-9, "m"),
					traps: [measureOption(C_LUMIERE * f, "m"), measureOption(f / C_LUMIERE, "m"), measureOption(lambdaNm, "m")],
					perturb: (s) => near(lambdaNm * 1e-9, "m", s)
				};
			}
			const kHz = difficulty === 2;
			const f = kHz ? pick([1, 2, 4, 5, 8, 10, 17]) : pick([170, 340, 425, 680, 850, 1700]);
			const fHz = kHz ? f * 1000 : f;
			return {
				text: `Un son de fréquence ${f} ${kHz ? "kHz" : "Hz"} se propage dans l'air à ${V_SON} m·s⁻¹. Quelle est sa longueur d'onde ?`,
				answer: measureOption(V_SON / fHz, "m"),
				traps: [measureOption(V_SON * fHz, "m"), measureOption(fHz / V_SON, "m"), kHz ? measureOption(V_SON / f, "m") : measureOption(V_SON / fHz / 1000, "m")],
				perturb: (s) => near(V_SON / fHz, "m", s)
			};
		}
	},

	periode: {
		label: "Période et fréquence T = 1 / f",
		generate(difficulty) {
			if (difficulty === 1) {
				const T = pick([0.5, 0.25, 0.2, 0.1, 0.05, 0.02, 0.01]);
				return {
					text: `Un signal périodique a une période de ${formatSig(T)} s. Quelle est sa fréquence ?`,
					answer: measureOption(1 / T, "Hz"),
					traps: [measureOption(T, "Hz"), measureOption(T * 1000, "Hz"), measureOption(1 / T / 1000, "Hz")],
					perturb: (s) => near(1 / T, "Hz", s)
				};
			}
			// Fréquence en kHz, période demandée en ms
			const f = pick([0.5, 1, 2, 4, 5, 10, 20, 25]);
			return {
				text: `Un signal a une fréquence de ${formatSig(f)} kHz. Quelle est sa période en millisecondes ?`,
				answer: measureOption(1 / f, "ms"),
				traps: [measureOption(f, "ms"), measureOption(1000 / f, "ms"), measureOption(1 / (f * 1000), "ms")],
				perturb: (s) => near(1 / f, "ms", s)
			};
		}
	},

	orage: {
		label: "Propagation du son (distance d'un orage)",
		generate(difficulty) {
			const t = difficulty === 1 ? randInt(2, 10) : randInt(3, 30) / 2;
			const d = V_SON * t;
			const km = difficulty === 3;
			return {
				text: `On entend le tonnerre ${formatSig(t)} s après avoir vu l'éclair (son : 340 m·s⁻¹). À quelle distance l'orage se trouve-t-il${km ? " en kilomètres" : ""} ?`,
				answer: measureOption(km ? d / 1000 : d, km ? "km" : "m"),
				traps: [
					measureOption(km ? (C_LUMIERE * t) / 1000 : C_LUMIERE * t, km ? "km" : "m"),
					measureOption(km ? t / V_SON / 1000 : t / V_SON, km ? "km" : "m"),
					measureOption(km ? d : d / 1000, km ? "km" : "m")
				],
				perturb: (s) => near(km ? d / 1000 : d, km ? "km" : "m", s)
			};
		}
	}
};

module.exports = { id: "pc_ondes", title: "Ondes : son et lumière", level: "2nde / 1re", subject: "Physique-chimie", types };
