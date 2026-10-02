const { randInt, pick, formatSig, measureOption, delta } = require("./utils");

const near = (value, unit, spread) => measureOption(value * (1 + delta(spread) * 0.12), unit);

// Masses molaires atomiques (g·mol⁻¹)
const ATOMS = { H: 1, C: 12, N: 14, O: 16, Na: 23, Mg: 24, S: 32, Cl: 35.5, K: 39, Ca: 40 };

// Molécules : formule écrite, composition, nom
const MOLECULES = [
	{ formula: "H₂O", atoms: { H: 2, O: 1 }, name: "eau", of: "de l'eau" },
	{ formula: "CO₂", atoms: { C: 1, O: 2 }, name: "dioxyde de carbone", of: "du dioxyde de carbone" },
	{ formula: "O₂", atoms: { O: 2 }, name: "dioxygène", of: "du dioxygène" },
	{ formula: "NH₃", atoms: { N: 1, H: 3 }, name: "ammoniac", of: "de l'ammoniac" },
	{ formula: "CH₄", atoms: { C: 1, H: 4 }, name: "méthane", of: "du méthane" },
	{ formula: "NaCl", atoms: { Na: 1, Cl: 1 }, name: "chlorure de sodium", of: "du chlorure de sodium" },
	{ formula: "C₂H₆O", atoms: { C: 2, H: 6, O: 1 }, name: "éthanol", of: "de l'éthanol" },
	{ formula: "C₆H₁₂O₆", atoms: { C: 6, H: 12, O: 6 }, name: "glucose", of: "du glucose" },
	{ formula: "H₂SO₄", atoms: { H: 2, S: 1, O: 4 }, name: "acide sulfurique", of: "de l'acide sulfurique" },
	{ formula: "CaCO₃", atoms: { Ca: 1, C: 1, O: 3 }, name: "carbonate de calcium", of: "du carbonate de calcium" },
	{ formula: "MgCl₂", atoms: { Mg: 1, Cl: 2 }, name: "chlorure de magnésium", of: "du chlorure de magnésium" }
];

const molarMass = (mol) => Object.entries(mol.atoms).reduce((s, [el, k]) => s + ATOMS[el] * k, 0);
const atomsList = (mol) => Object.keys(mol.atoms).map((el) => `${el} = ${formatSig(ATOMS[el])}`).join(" ; ");

const types = {
	masse_molaire: {
		label: "Masse molaire d'une molécule",
		generate(difficulty) {
			const pool = difficulty === 1 ? MOLECULES.slice(0, 5) : difficulty === 2 ? MOLECULES.slice(0, 8) : MOLECULES.slice(5);
			const mol = pick(pool);
			const M = molarMass(mol);
			// Piège : oublier les indices (chaque atome compté une fois)
			const once = Object.keys(mol.atoms).reduce((s, el) => s + ATOMS[el], 0);
			const sumIndices = Object.values(mol.atoms).reduce((a, b) => a + b, 0);
			return {
				text: `Calculer la masse molaire ${mol.of} ${mol.formula} (M en g·mol⁻¹ : ${atomsList(mol)}).`,
				answer: measureOption(M, "g·mol⁻¹"),
				traps: [measureOption(once, "g·mol⁻¹"), measureOption(once * sumIndices, "g·mol⁻¹"), measureOption(M + ATOMS[Object.keys(mol.atoms)[0]], "g·mol⁻¹")],
				perturb: (s) => measureOption(M + delta(s), "g·mol⁻¹")
			};
		}
	},

	quantite: {
		label: "Quantité de matière n = m / M",
		generate(difficulty) {
			const mol = pick(MOLECULES);
			const M = molarMass(mol);
			if (difficulty === 3) {
				const n = randInt(1, 40) / 10;
				return {
					text: `Quelle masse de ${mol.name} (M = ${formatSig(M)} g·mol⁻¹) contient ${formatSig(n)} mol ?`,
					answer: measureOption(n * M, "g"),
					traps: [measureOption(n / M, "g"), measureOption(M / n, "g"), measureOption(n + M, "g")],
					perturb: (s) => near(n * M, "g", s)
				};
			}
			const n = randInt(1, difficulty === 1 ? 10 : 50) / 10;
			const m = n * M;
			const kg = difficulty === 2 && m >= 100;
			return {
				text: `Quelle quantité de matière contiennent ${formatSig(kg ? m / 1000 : m)} ${kg ? "kg" : "g"} de ${mol.name} (M = ${formatSig(M)} g·mol⁻¹) ?`,
				answer: measureOption(n, "mol"),
				traps: [measureOption(m * M, "mol"), measureOption(M / m, "mol"), kg ? measureOption(n / 1000, "mol") : measureOption(n * 10, "mol")],
				perturb: (s) => near(n, "mol", s)
			};
		}
	},

	concentration: {
		label: "Concentration C = n / V",
		generate(difficulty) {
			const n = randInt(1, 50) / 100;
			if (difficulty === 1) {
				const V = pick([0.5, 1, 2, 0.25]);
				return {
					text: `On dissout ${formatSig(n)} mol de soluté dans ${formatSig(V)} L de solution. Quelle est la concentration ?`,
					answer: measureOption(n / V, "mol·L⁻¹"),
					traps: [measureOption(n * V, "mol·L⁻¹"), measureOption(V / n, "mol·L⁻¹"), measureOption(n / V / 1000, "mol·L⁻¹")],
					perturb: (s) => near(n / V, "mol·L⁻¹", s)
				};
			}
			// Volume en mL : il faut le convertir en L
			const mL = pick([50, 100, 200, 250, 500]);
			if (difficulty === 2) {
				return {
					text: `On dissout ${formatSig(n)} mol de soluté dans ${mL} mL de solution. Quelle est la concentration ?`,
					answer: measureOption(n / (mL / 1000), "mol·L⁻¹"),
					traps: [measureOption(n / mL, "mol·L⁻¹"), measureOption(n * (mL / 1000), "mol·L⁻¹"), measureOption(mL / 1000 / n, "mol·L⁻¹")],
					perturb: (s) => near(n / (mL / 1000), "mol·L⁻¹", s)
				};
			}
			// Concentration en masse
			const m = randInt(1, 40) / 2;
			return {
				text: `On dissout ${formatSig(m)} g de sel dans ${mL} mL d'eau. Quelle est la concentration en masse de la solution ?`,
				answer: measureOption(m / (mL / 1000), "g·L⁻¹"),
				traps: [measureOption(m / mL, "g·L⁻¹"), measureOption(m * (mL / 1000), "g·L⁻¹"), measureOption(mL / m, "g·L⁻¹")],
				perturb: (s) => near(m / (mL / 1000), "g·L⁻¹", s)
			};
		}
	},

	dilution: {
		label: "Dilution C₁V₁ = C₂V₂",
		generate(difficulty) {
			const factor = pick(difficulty === 1 ? [2, 5, 10] : [2, 4, 5, 10, 20, 25]);
			const C1 = pick([0.1, 0.2, 0.5, 1, 2]);
			const V2 = pick([50, 100, 200, 250, 500]);
			const C2 = C1 / factor, V1 = (C2 * V2) / C1;
			if (difficulty === 1) {
				return {
					text: `On dilue ${factor} fois une solution de concentration ${formatSig(C1)} mol·L⁻¹. Quelle est la concentration de la solution fille ?`,
					answer: measureOption(C2, "mol·L⁻¹"),
					traps: [measureOption(C1 * factor, "mol·L⁻¹"), measureOption(C1 / (factor + 1), "mol·L⁻¹"), measureOption(factor / C1, "mol·L⁻¹")],
					perturb: (s) => near(C2, "mol·L⁻¹", s)
				};
			}
			return {
				text: `On veut préparer ${V2} mL de solution à ${formatSig(C2)} mol·L⁻¹ à partir d'une solution mère à ${formatSig(C1)} mol·L⁻¹. Quel volume de solution mère faut-il prélever ?`,
				answer: measureOption(V1, "mL"),
				traps: [measureOption((C1 * V2) / C2, "mL"), measureOption(C1 * C2 * V2, "mL"), measureOption(V2 - V1, "mL")],
				perturb: (s) => near(V1, "mL", s)
			};
		}
	}
};

module.exports = { id: "pc_matiere", title: "Quantité de matière et solutions", level: "2nde / 1re", subject: "Physique-chimie", types };
