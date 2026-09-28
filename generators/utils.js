// Outils communs aux générateurs de questions de maths

function randInt(min, max) {
	return Math.floor(Math.random() * (max - min + 1)) + min;
}

// Entier non nul entre min et max
function randNonZero(min, max) {
	let n = 0;
	while (n === 0) {
		n = randInt(min, max);
	}
	return n;
}

// Décalage aléatoire non nul, de plus en plus large si le générateur manque de réponses distinctes
function delta(spread = 2) {
	return randNonZero(-spread, spread);
}

function pick(array) {
	return array[Math.floor(Math.random() * array.length)];
}

function shuffle(array) {
	const copy = [...array];
	for (let i = copy.length - 1; i > 0; i--) {
		const j = Math.floor(Math.random() * (i + 1));
		[copy[i], copy[j]] = [copy[j], copy[i]];
	}
	return copy;
}

function gcd(a, b) {
	a = Math.abs(a);
	b = Math.abs(b);
	while (b) {
		[a, b] = [b, a % b];
	}
	return a;
}

const SUPERSCRIPTS = { "0": "⁰", "1": "¹", "2": "²", "3": "³", "4": "⁴", "5": "⁵", "6": "⁶", "7": "⁷", "8": "⁸", "9": "⁹", "-": "⁻" };

function sup(n) {
	return String(n).split("").map((c) => SUPERSCRIPTS[c]).join("");
}

// ---------- Polynômes : coeffs[i] = coefficient de x^i ----------

function polyTrim(coeffs) {
	const c = [...coeffs];
	while (c.length > 1 && c[c.length - 1] === 0) {
		c.pop();
	}
	return c;
}

function polyMul(p, q) {
	const result = new Array(p.length + q.length - 1).fill(0);
	p.forEach((a, i) => q.forEach((b, j) => { result[i + j] += a * b; }));
	return polyTrim(result);
}

// Affiche un polynôme : [1, -2, 3] -> "3x² - 2x + 1"
function polyFormat(coeffs, v = "x") {
	const terms = [];
	for (let i = coeffs.length - 1; i >= 0; i--) {
		const c = coeffs[i];
		if (c === 0) {
			continue;
		}
		const abs = Math.abs(c);
		const coef = i > 0 && abs === 1 ? "" : String(abs);
		const variable = i === 0 ? "" : i === 1 ? v : v + sup(i);
		const sign = c < 0 ? "-" : "+";
		terms.push({ sign, text: coef + variable });
	}
	if (terms.length === 0) {
		return "0";
	}
	return terms.map((t, k) => (k === 0 ? (t.sign === "-" ? "-" : "") + t.text : ` ${t.sign} ${t.text}`)).join("");
}

// Option de réponse polynomiale : la clé sert à détecter deux réponses mathématiquement égales
function polyOption(coeffs, text) {
	const trimmed = polyTrim(coeffs);
	return { text: text || polyFormat(trimmed), key: "p:" + trimmed.join(",") };
}

// Facteur affine (ax + b) entre parenthèses
function linear(a, b, v = "x") {
	return "(" + polyFormat([b, a], v) + ")";
}

// Forme factorisée k·(a1x+b1)(a2x+b2)... ; la clé est le développement, pour comparer avec les autres options
function factoredOption(k, factors, v = "x") {
	let poly = [k];
	factors.forEach(([a, b]) => { poly = polyMul(poly, [b, a]); });

	let prefix = "";
	if (k === -1) prefix = "-";
	else if (k !== 1) prefix = String(k);

	let text;
	if (factors.length === 2 && factors[0][0] === factors[1][0] && factors[0][1] === factors[1][1]) {
		text = prefix + linear(factors[0][0], factors[0][1], v) + "²";
	} else {
		text = prefix + factors.map(([a, b]) => linear(a, b, v)).join("");
	}
	return { text, key: "p:" + polyTrim(poly).join(",") };
}

// ---------- Nombres et fractions ----------

function numberOption(value, text) {
	const rounded = Math.round(value * 1e9) / 1e9;
	return { text: text ?? formatNumber(rounded), key: "n:" + rounded };
}

function formatNumber(x) {
	const rounded = Math.round(x * 1e6) / 1e6;
	return String(rounded).replace(".", ",");
}

// Fraction irréductible avec dénominateur positif
function fraction(n, d) {
	if (d < 0) {
		n = -n;
		d = -d;
	}
	const g = gcd(n, d) || 1;
	return { n: n / g, d: d / g };
}

function fractionText({ n, d }) {
	return d === 1 ? String(n) : `${n}/${d}`;
}

function fractionOption(n, d) {
	if (d === 0) {
		return null;
	}
	const f = fraction(n, d);
	return { text: fractionText(f), key: "n:" + Math.round((f.n / f.d) * 1e9) / 1e9 };
}

// Option textuelle quelconque : deux options sont égales si leur texte l'est
function textOption(text) {
	return { text, key: "t:" + text };
}

// Difficulté 1..3 -> bornes des coefficients
function range(difficulty, easy, medium, hard) {
	return [easy, medium, hard][difficulty - 1];
}

module.exports = {
	randInt,
	randNonZero,
	delta,
	pick,
	shuffle,
	gcd,
	sup,
	polyMul,
	polyFormat,
	polyOption,
	linear,
	factoredOption,
	numberOption,
	formatNumber,
	fraction,
	fractionText,
	fractionOption,
	textOption,
	range
};
