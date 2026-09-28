const { randInt, randNonZero, pick, sup, polyFormat, polyOption, textOption, range, delta } = require("./utils");

function derivative(coeffs) {
	return coeffs.length === 1 ? [0] : coeffs.slice(1).map((c, i) => c * (i + 1));
}

// Écrit « (2x + 3) », ou « x » sans parenthèses si inutile
function inner(a, b) {
	const text = polyFormat([b, a]);
	return b === 0 && a === 1 ? text : `(${text})`;
}

// P(x)·eˣ : « (2x + 1)eˣ », ou « -2eˣ » si P est constant
function expTimes(coeffs) {
	const p = coeffs.length > 1 && coeffs.slice(1).every((c) => c === 0) ? [coeffs[0]] : coeffs;
	return p.length === 1 ? (p[0] === 0 ? "0" : coef(p[0]) + "eˣ") : `(${polyFormat(p)})eˣ`;
}

// Coefficient devant une expression : 1 -> "", -1 -> "-"
function coef(k) {
	return k === 1 ? "" : k === -1 ? "-" : String(k);
}

const types = {
	polynome: {
		label: "Dérivée d'un polynôme",
		generate(difficulty) {
			const degree = range(difficulty, 2, 3, 4);
			const coeffs = Array.from({ length: degree + 1 }, () => randInt(-9, 9));
			coeffs[degree] = randNonZero(-6, 6);
			if (coeffs[0] === 0) coeffs[0] = randNonZero(-9, 9);
			const d = derivative(coeffs);
			const keptConstant = [d[0] + coeffs[0], ...d.slice(1)];
			const signError = d.map((c, i) => (i === 0 ? c : -c));
			const option = (p) => polyOption(p, "f'(x) = " + polyFormat(p));
			return {
				text: `Calculer f'(x) pour f(x) = ${polyFormat(coeffs)}`,
				answer: option(d),
				traps: [
					// Constante conservée, exposant non multiplié, exposant non diminué
					option(keptConstant),
					option(coeffs.slice(1)),
					option([0, ...d]),
					option(signError)
				],
				perturb: (spread) => {
					const p = [...d];
					const i = randInt(0, p.length - 1);
					p[i] += delta(spread);
					return option(p);
				}
			};
		}
	},

	composee: {
		label: "Fonctions composées (ax + b)ⁿ, e^(ax+b), √(ax+b)",
		generate(difficulty) {
			const a = range(difficulty, randInt(2, 5), randNonZero(-6, 6), randNonZero(-9, 9));
			const b = randNonZero(-9, 9);
			const u = inner(a, b);
			const form = range(difficulty, "puissance", pick(["puissance", "exp"]), pick(["puissance", "exp", "racine"]));
			const t = (s) => textOption("f'(x) = " + s);

			if (form === "exp") {
				const e = `e^${u}`;
				return {
					text: `Calculer f'(x) pour f(x) = ${e}`,
					answer: t(`${coef(a)}${e}`),
					traps: [t(e), t(`${u}${e.replace(u, `(${polyFormat([b - 1, a])})`)}`), t(`${coef(a)}xe^${u}`), t(`${coef(-a)}${e}`)],
					perturb: (spread) => t(`${coef(a + delta(spread) || 2)}${e}`)
				};
			}
			if (form === "racine") {
				const r = `√${u}`;
				return {
					text: `Calculer f'(x) pour f(x) = ${r}`,
					answer: t(`${a}/(2${r})`),
					traps: [t(`1/(2${r})`), t(`${a}/${r}`), t(`${2 * a}${r}`), t(`1/${r}`)],
					perturb: (spread) => t(`${a + delta(spread)}/(2${r})`)
				};
			}
			const n = range(difficulty, randInt(2, 4), randInt(2, 6), randInt(2, 9));
			const pow = (k, m) => `${coef(k)}${u}${m === 1 ? "" : sup(m)}`;
			return {
				text: `Calculer f'(x) pour f(x) = ${u}${sup(n)}`,
				answer: t(pow(n * a, n - 1)),
				traps: [t(pow(n, n - 1)), t(pow(n * a, n)), t(pow(a, n - 1)), t(pow(n * a, n + 1))],
				perturb: (spread) => t(pow(n * a + delta(spread), n - 1))
			};
		}
	},

	produit_exp: {
		label: "Dérivée d'un produit P(x)·eˣ",
		generate(difficulty) {
			const degree = range(difficulty, 1, 1, 2);
			const p = Array.from({ length: degree + 1 }, () => randInt(-6, 6));
			p[degree] = randNonZero(-5, 5);
			const dp = derivative(p);
			const sum = p.map((c, i) => c + (dp[i] || 0));
			const t = (coeffs) => polyOption(coeffs, `f'(x) = ${expTimes(coeffs)}`);
			return {
				text: `Calculer f'(x) pour f(x) = ${expTimes(p)}`,
				// Clés distinctes des autres chapitres : le facteur eˣ est commun à toutes les options
				answer: t(sum),
				traps: [
					t(dp),
					t(p),
					t(p.map((c, i) => c - (dp[i] || 0))),
					t(p.map((c, i) => c * (dp[i] || 0)))
				],
				perturb: (spread) => {
					const q = [...sum];
					q[randInt(0, q.length - 1)] += delta(spread);
					return t(q);
				}
			};
		}
	}
};

module.exports = {
	id: "derivees",
	title: "Dérivation",
	level: "Lycée (1re-Tle spé)",
	types
};
