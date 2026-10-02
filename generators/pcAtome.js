const { pick, sup, numberOption, delta, range } = require("./utils");

const SUBSCRIPTS = "₀₁₂₃₄₅₆₇₈₉";
const sub = (n) => String(n).split("").map((c) => SUBSCRIPTS[c]).join("");

// Symbole, nombre de masse A, numéro atomique Z, nom
const ELEMENTS = [
	["C", 12, 6, "carbone"], ["N", 14, 7, "azote"], ["O", 16, 8, "oxygène"], ["Na", 23, 11, "sodium"],
	["Mg", 24, 12, "magnésium"], ["Al", 27, 13, "aluminium"], ["S", 32, 16, "soufre"], ["Cl", 35, 17, "chlore"],
	["Ca", 40, 20, "calcium"], ["Fe", 56, 26, "fer"], ["Cu", 63, 29, "cuivre"], ["Zn", 65, 30, "zinc"],
	["Ag", 108, 47, "argent"], ["Au", 197, 79, "or"], ["U", 238, 92, "uranium"]
];

// Ions monoatomiques usuels : symbole, charge
const IONS = [["Na", 1], ["K", 1], ["Mg", 2], ["Ca", 2], ["Al", 3], ["Fe", 2], ["Fe", 3], ["Cu", 2], ["Zn", 2], ["Cl", -1], ["O", -2], ["S", -2]];
const ION_Z = { Na: 11, K: 19, Mg: 12, Ca: 20, Al: 13, Fe: 26, Cu: 29, Zn: 30, Cl: 17, O: 8, S: 16 };

const nucleus = ([sym, A, Z]) => `${sup(A)}${sub(Z)}${sym}`;
const count = (n) => numberOption(n, String(n));

const types = {
	noyau: {
		label: "Composition d'un atome (protons, neutrons, électrons)",
		generate(difficulty) {
			const pool = range(difficulty, ELEMENTS.slice(0, 6), ELEMENTS.slice(0, 11), ELEMENTS.slice(6));
			const el = pick(pool);
			const [, A, Z, name] = el;
			const what = difficulty === 1 ? pick(["protons", "neutrons"]) : pick(["protons", "neutrons", "électrons", "nucléons"]);
			const value = { protons: Z, neutrons: A - Z, "électrons": Z, nucléons: A }[what];
			return {
				text: `Combien l'atome de ${name} ${nucleus(el)} contient-il de ${what} ?`,
				answer: count(value),
				traps: [count(A), count(Z), count(A + Z), count(A - Z)],
				perturb: (s) => count(Math.max(0, value + delta(s)))
			};
		}
	},

	ion: {
		label: "Électrons d'un ion monoatomique",
		generate() {
			const [sym, charge] = pick(IONS);
			const Z = ION_Z[sym];
			const label = sym + (Math.abs(charge) === 1 ? "" : sup(Math.abs(charge))) + (charge > 0 ? "⁺" : "⁻");
			const electrons = Z - charge;
			return {
				text: `Combien d'électrons possède l'ion ${label} (numéro atomique Z = ${Z}) ?`,
				// Pièges : signe de la charge inversé, électrons de l'atome neutre
				answer: count(electrons),
				traps: [count(Z + charge), count(Z), count(Math.abs(charge))],
				perturb: (s) => count(Math.max(0, electrons + delta(s)))
			};
		}
	}
};

module.exports = { id: "pc_atome", title: "Atome, noyau et ions", level: "2nde", subject: "Physique-chimie", types };
