const { randInt, pick, formatSig, measureOption, range, delta } = require("./utils");

const G_TERRE = 9.8, G_LUNE = 1.6;

// Réponse proche : la bonne valeur légèrement faussée
const near = (value, unit, spread) => measureOption(value * (1 + delta(spread) * 0.12), unit);

const types = {
	vitesse: {
		label: "Vitesse moyenne v = d / t",
		generate(difficulty) {
			if (difficulty === 1) {
				const t = randInt(2, 20), v = randInt(2, 15);
				const d = v * t;
				return {
					text: `Un cycliste parcourt ${d} m en ${t} s. Quelle est sa vitesse moyenne ?`,
					answer: measureOption(v, "m·s⁻¹"),
					traps: [measureOption(d * t, "m·s⁻¹"), measureOption(t / d, "m·s⁻¹"), measureOption(v * 3.6, "m·s⁻¹")],
					perturb: (s) => near(v, "m·s⁻¹", s)
				};
			}
			// Distance en km et durée en minutes : la vitesse est demandée en km/h
			const minutes = pick([15, 20, 30, 40, 45, 90]), v = randInt(range(difficulty, 0, 3, 6), 12) * 10;
			const d = (v * minutes) / 60;
			return {
				text: `Une voiture parcourt ${formatSig(d)} km en ${minutes} minutes. Quelle est sa vitesse moyenne en km·h⁻¹ ?`,
				answer: measureOption(v, "km·h⁻¹"),
				traps: [measureOption(d / minutes, "km·h⁻¹"), measureOption(d * minutes, "km·h⁻¹"), measureOption(v / 3.6, "km·h⁻¹")],
				perturb: (s) => near(v, "km·h⁻¹", s)
			};
		}
	},

	conversion: {
		label: "Conversion km·h⁻¹ ↔ m·s⁻¹",
		generate(difficulty) {
			const toMs = difficulty === 1 ? true : Math.random() < 0.5;
			if (toMs) {
				const v = pick([18, 36, 54, 72, 90, 108, 126, 144]);
				return {
					text: `Convertir ${v} km·h⁻¹ en m·s⁻¹.`,
					answer: measureOption(v / 3.6, "m·s⁻¹"),
					traps: [measureOption(v * 3.6, "m·s⁻¹"), measureOption(v / 60, "m·s⁻¹"), measureOption(v * 1000, "m·s⁻¹")],
					perturb: (s) => near(v / 3.6, "m·s⁻¹", s)
				};
			}
			const v = randInt(2, 40) * (difficulty === 3 ? 1.5 : 1);
			return {
				text: `Convertir ${formatSig(v)} m·s⁻¹ en km·h⁻¹.`,
				answer: measureOption(v * 3.6, "km·h⁻¹"),
				traps: [measureOption(v / 3.6, "km·h⁻¹"), measureOption(v * 60, "km·h⁻¹"), measureOption(v / 1000, "km·h⁻¹")],
				perturb: (s) => near(v * 3.6, "km·h⁻¹", s)
			};
		}
	},

	poids: {
		label: "Poids P = m × g",
		generate(difficulty) {
			if (difficulty === 3) {
				// Sur la Lune, ou retrouver la masse à partir du poids
				const m = randInt(5, 90);
				if (Math.random() < 0.5) {
					return {
						text: `Un astronaute a une masse de ${m} kg. Quel est son poids sur la Lune (g = ${formatSig(G_LUNE)} N·kg⁻¹) ?`,
						answer: measureOption(m * G_LUNE, "N"),
						traps: [measureOption(m * G_TERRE, "N"), measureOption(m, "N"), measureOption(m / G_LUNE, "N")],
						perturb: (s) => near(m * G_LUNE, "N", s)
					};
				}
				const P = m * G_TERRE;
				return {
					text: `Un objet a un poids de ${formatSig(P)} N sur Terre (g = 9,8 N·kg⁻¹). Quelle est sa masse ?`,
					answer: measureOption(m, "kg"),
					traps: [measureOption(P * G_TERRE, "kg"), measureOption(P, "kg"), measureOption(m * 1000, "kg")],
					perturb: (s) => near(m, "kg", s)
				};
			}
			const grams = difficulty === 2;
			const m = grams ? randInt(1, 40) * 50 : randInt(2, 80);
			const kg = grams ? m / 1000 : m;
			return {
				text: `Quel est le poids sur Terre d'un objet de masse ${m} ${grams ? "g" : "kg"} (g = 9,8 N·kg⁻¹) ?`,
				answer: measureOption(kg * G_TERRE, "N"),
				traps: [
					measureOption(m * G_TERRE, "N"),
					measureOption(kg, "N"),
					measureOption(kg / G_TERRE, "N")
				],
				perturb: (s) => near(kg * G_TERRE, "N", s)
			};
		}
	},

	energie_cinetique: {
		label: "Énergie cinétique Ec = ½ m v²",
		generate(difficulty) {
			const m = range(difficulty, randInt(1, 10), randInt(50, 1500), randInt(1, 100));
			if (difficulty === 3) {
				// Retrouver la vitesse à partir de l'énergie
				const v = randInt(2, 30);
				const Ec = 0.5 * m * v * v;
				return {
					text: `Un objet de masse ${m} kg a une énergie cinétique de ${formatSig(Ec, 4)} J. Quelle est sa vitesse ?`,
					answer: measureOption(v, "m·s⁻¹"),
					traps: [measureOption(Math.sqrt(Ec / m), "m·s⁻¹"), measureOption((2 * Ec) / m, "m·s⁻¹"), measureOption(Ec / m, "m·s⁻¹")],
					perturb: (s) => near(v, "m·s⁻¹", s)
				};
			}
			// Difficulté 2 : la vitesse est donnée en km/h, il faut la convertir
			const kmh = difficulty === 2;
			const v = kmh ? pick([18, 36, 54, 72, 90, 108]) : randInt(2, 15);
			const vms = kmh ? v / 3.6 : v;
			const Ec = 0.5 * m * vms * vms;
			return {
				text: `Calculer l'énergie cinétique d'un objet de masse ${m} kg roulant à ${v} ${kmh ? "km·h⁻¹" : "m·s⁻¹"}.`,
				answer: measureOption(Ec, "J"),
				traps: [
					measureOption(m * vms * vms, "J"),
					measureOption(0.5 * m * vms, "J"),
					kmh ? measureOption(0.5 * m * v * v, "J") : measureOption((0.5 * m * vms) ** 2, "J")
				],
				perturb: (s) => near(Ec, "J", s)
			};
		}
	},

	energie_potentielle: {
		label: "Énergie potentielle de pesanteur Epp = m g h",
		generate(difficulty) {
			const m = randInt(1, 80);
			if (difficulty === 3) {
				const h = randInt(2, 50);
				const E = m * G_TERRE * h;
				return {
					text: `Un objet de ${m} kg a une énergie potentielle de pesanteur de ${formatSig(E, 4)} J (g = 9,8 N·kg⁻¹). À quelle hauteur est-il ?`,
					answer: measureOption(h, "m"),
					traps: [measureOption(E / m, "m"), measureOption(E * m * G_TERRE, "m"), measureOption(E / G_TERRE, "m")],
					perturb: (s) => near(h, "m", s)
				};
			}
			const cm = difficulty === 2;
			const h = cm ? randInt(10, 95) : randInt(1, 30);
			const hm = cm ? h / 100 : h;
			return {
				text: `Calculer l'énergie potentielle de pesanteur d'un objet de ${m} kg situé à ${h} ${cm ? "cm" : "m"} du sol (g = 9,8 N·kg⁻¹).`,
				answer: measureOption(m * G_TERRE * hm, "J"),
				traps: [measureOption(m * hm, "J"), measureOption(m * G_TERRE * h * (cm ? 1 : 100), "J"), measureOption((m / G_TERRE) * hm, "J")],
				perturb: (s) => near(m * G_TERRE * hm, "J", s)
			};
		}
	}
};

module.exports = { id: "pc_mecanique", title: "Mécanique : vitesse, poids, énergie", level: "2nde / 1re", subject: "Physique-chimie", types };
