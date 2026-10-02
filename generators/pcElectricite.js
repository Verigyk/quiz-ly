const { randInt, pick, formatSig, measureOption, delta } = require("./utils");

const near = (value, unit, spread) => measureOption(value * (1 + delta(spread) * 0.12), unit);

const types = {
	ohm: {
		label: "Loi d'Ohm U = R × I",
		generate(difficulty) {
			const R = pick([10, 22, 47, 100, 150, 220, 330, 470, 1000]);
			if (difficulty === 1) {
				const I = randInt(1, 9) / 10;
				return {
					text: `Un conducteur ohmique de résistance R = ${R} Ω est traversé par un courant I = ${formatSig(I)} A. Quelle est la tension U à ses bornes ?`,
					answer: measureOption(R * I, "V"),
					traps: [measureOption(R / I, "V"), measureOption(I / R, "V"), measureOption(R + I, "V")],
					perturb: (s) => near(R * I, "V", s)
				};
			}
			// Intensité en mA : il faut la convertir en A
			const mA = randInt(2, 90);
			const I = mA / 1000;
			if (difficulty === 2) {
				return {
					text: `Un conducteur ohmique de ${R} Ω est traversé par un courant de ${mA} mA. Quelle est la tension à ses bornes ?`,
					answer: measureOption(R * I, "V"),
					traps: [measureOption(R * mA, "V"), measureOption(R / I, "V"), measureOption(I / R, "V")],
					perturb: (s) => near(R * I, "V", s)
				};
			}
			const U = R * I;
			return {
				text: `La tension aux bornes d'un conducteur ohmique vaut ${formatSig(U)} V quand il est traversé par ${mA} mA. Quelle est sa résistance ?`,
				answer: measureOption(R, "Ω"),
				traps: [measureOption(U / mA, "Ω"), measureOption(U * I, "Ω"), measureOption(I / U, "Ω")],
				perturb: (s) => near(R, "Ω", s)
			};
		}
	},

	puissance: {
		label: "Puissance électrique P = U × I",
		generate(difficulty) {
			const U = pick([6, 12, 24, 110, 230]);
			if (difficulty === 1) {
				const I = randInt(1, 20) / 2;
				return {
					text: `Un appareil alimenté sous ${U} V est traversé par un courant de ${formatSig(I)} A. Quelle est sa puissance ?`,
					answer: measureOption(U * I, "W"),
					traps: [measureOption(U / I, "W"), measureOption(I / U, "W"), measureOption(U + I, "W")],
					perturb: (s) => near(U * I, "W", s)
				};
			}
			if (difficulty === 2) {
				const R = pick([10, 20, 50, 100, 200]);
				return {
					text: `Un conducteur ohmique de ${R} Ω est soumis à une tension de ${U} V. Quelle puissance reçoit-il ?`,
					answer: measureOption((U * U) / R, "W"),
					traps: [measureOption(U / R, "W"), measureOption(U * R, "W"), measureOption(U * U * R, "W")],
					perturb: (s) => near((U * U) / R, "W", s)
				};
			}
			const P = pick([60, 100, 500, 1000, 1500, 2000]);
			return {
				text: `Un appareil de ${P} W fonctionne sous ${U} V. Quelle est l'intensité du courant qui le traverse ?`,
				answer: measureOption(P / U, "A"),
				traps: [measureOption(P * U, "A"), measureOption(U / P, "A"), measureOption(P - U, "A")],
				perturb: (s) => near(P / U, "A", s)
			};
		}
	},

	energie: {
		label: "Énergie électrique E = P × Δt",
		generate(difficulty) {
			const P = pick([40, 60, 100, 500, 800, 1000, 2000]);
			if (difficulty === 1) {
				const t = randInt(2, 60);
				return {
					text: `Une lampe de ${P} W reste allumée pendant ${t} s. Quelle énergie a-t-elle consommée ?`,
					answer: measureOption(P * t, "J"),
					traps: [measureOption(P / t, "J"), measureOption(t / P, "J"), measureOption(P * t * 3600, "J")],
					perturb: (s) => near(P * t, "J", s)
				};
			}
			const h = randInt(1, 10);
			if (difficulty === 2) {
				return {
					text: `Un appareil de ${P} W fonctionne pendant ${h} h. Quelle énergie consomme-t-il en kWh ?`,
					answer: measureOption((P * h) / 1000, "kWh"),
					traps: [measureOption(P * h, "kWh"), measureOption(P * h * 3600, "kWh"), measureOption(P / h / 1000, "kWh")],
					perturb: (s) => near((P * h) / 1000, "kWh", s)
				};
			}
			return {
				text: `Un appareil de ${P} W fonctionne pendant ${h} h. Quelle énergie consomme-t-il en joules ?`,
				answer: measureOption(P * h * 3600, "J"),
				traps: [measureOption(P * h, "J"), measureOption(P * h * 60, "J"), measureOption((P * h) / 1000, "J")],
				perturb: (s) => near(P * h * 3600, "J", s)
			};
		}
	}
};

module.exports = { id: "pc_electricite", title: "Électricité : loi d'Ohm, puissance, énergie", level: "2nde / 1re", subject: "Physique-chimie", types };
