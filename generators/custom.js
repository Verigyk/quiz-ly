// Modèles de questions créés par les professeurs : variables tirées au hasard et formules.
//
// Une formule s'écrit entre accolades dans les textes : « Développer (x + {a})² » → « Développer (x + 3)² ».
// Les formules sont évaluées par une petite calculatrice (jamais par eval) : nombres, variables,
// + - * / ^ %, parenthèses, comparaisons, « et » / « ou », et quelques fonctions mathématiques.
const { gcd, polyFormat, fraction, fractionText, shuffle, formatNumber } = require("./utils");

// ---------- Lecture des formules ----------

function tokenize(source) {
	const tokens = [];
	const re = /\s*(?:(\d+(?:[.,]\d+)?)|([A-Za-zÀ-ÿ_][A-Za-zÀ-ÿ_0-9]*)|(==|!=|<=|>=|&&|\|\||[-+*/^%(),<>=!]))/y;
	let pos = 0;
	while (pos < source.length) {
		if (/^\s*$/.test(source.slice(pos))) break;
		re.lastIndex = pos;
		const m = re.exec(source);
		if (!m) throw new Error(`Caractère inattendu dans « ${source} » : « ${source.slice(pos).trim()[0]} »`);
		if (m[1] !== undefined) tokens.push({ type: "num", value: Number(m[1].replace(",", ".")) });
		else if (m[2] !== undefined) {
			const word = m[2].toLowerCase();
			if (word === "et") tokens.push({ type: "op", value: "&&" });
			else if (word === "ou") tokens.push({ type: "op", value: "||" });
			else tokens.push({ type: "name", value: m[2] });
		} else tokens.push({ type: "op", value: m[3] === "=" ? "==" : m[3] });
		pos = re.lastIndex;
	}
	return tokens;
}

// Fonctions disponibles dans les formules
const FUNCTIONS = {
	abs: (x) => Math.abs(num(x)),
	min: (...xs) => Math.min(...xs.map(num)),
	max: (...xs) => Math.max(...xs.map(num)),
	arrondi: (x, n = 0) => Math.round(num(x) * 10 ** num(n)) / 10 ** num(n),
	racine: (x) => Math.sqrt(num(x)),
	pgcd: (a, b) => gcd(num(a), num(b)),
	ppcm: (a, b) => Math.abs(num(a) * num(b)) / (gcd(num(a), num(b)) || 1),
	// Écritures mathématiques (renvoient du texte)
	frac: (n, d) => {
		if (num(d) === 0) throw new Error("division par zéro dans frac()");
		return fractionText(fraction(num(n), num(d)));
	},
	signe: (x) => (num(x) < 0 ? "- " : "+ ") + formatNumber(Math.abs(num(x))),
	par: (x) => (num(x) < 0 ? `(${formatNumber(num(x))})` : formatNumber(num(x))),
	// polynome(a, b, c) = ax² + bx + c ; les coefficients sont donnés du plus haut degré au plus bas
	polynome: (...coeffs) => polyFormat(coeffs.map(num).reverse()),
	rac: (x) => {
		const n = num(x);
		const r = Math.sqrt(n);
		if (Number.isInteger(r)) return String(r);
		// √(k²·m) = k√m
		for (let k = Math.floor(r); k > 1; k--) {
			if (n % (k * k) === 0) return `${k}√${n / (k * k)}`;
		}
		return `√${n}`;
	}
};

function num(value) {
	if (typeof value === "boolean") return value ? 1 : 0;
	if (typeof value !== "number") throw new Error(`« ${value} » n'est pas un nombre`);
	return value;
}

// Analyse descendante : priorité ou < et < comparaison < + - < * / % < puissance < unaire
function evaluate(source, vars) {
	const tokens = tokenize(source);
	let i = 0;
	const peek = () => tokens[i];
	const take = (value) => {
		const t = tokens[i];
		if (!t || (value && t.value !== value)) throw new Error(`Formule incorrecte : « ${source} »`);
		i++;
		return t;
	};

	function orExpr() {
		let left = andExpr();
		while (peek() && peek().value === "||") { take(); const right = andExpr(); left = Boolean(left) || Boolean(right); }
		return left;
	}
	function andExpr() {
		let left = comparison();
		while (peek() && peek().value === "&&") { take(); const right = comparison(); left = Boolean(left) && Boolean(right); }
		return left;
	}
	function comparison() {
		let left = additive();
		while (peek() && ["==", "!=", "<", ">", "<=", ">="].includes(peek().value)) {
			const op = take().value;
			const right = additive();
			if (op === "==") left = left === right;
			else if (op === "!=") left = left !== right;
			else if (op === "<") left = num(left) < num(right);
			else if (op === ">") left = num(left) > num(right);
			else if (op === "<=") left = num(left) <= num(right);
			else left = num(left) >= num(right);
		}
		return left;
	}
	function additive() {
		let left = multiplicative();
		while (peek() && ["+", "-"].includes(peek().value)) {
			const op = take().value;
			const right = multiplicative();
			left = op === "+" ? num(left) + num(right) : num(left) - num(right);
		}
		return left;
	}
	function multiplicative() {
		let left = unary();
		while (peek() && ["*", "/", "%"].includes(peek().value)) {
			const op = take().value;
			const right = unary();
			if (op === "*") left = num(left) * num(right);
			else if (num(right) === 0) throw new Error("division par zéro");
			else if (op === "/") left = num(left) / num(right);
			else left = ((num(left) % num(right)) + num(right)) % num(right);
		}
		return left;
	}
	function unary() {
		if (peek() && peek().value === "-") { take(); return -num(unary()); }
		if (peek() && peek().value === "+") { take(); return num(unary()); }
		if (peek() && peek().value === "!") { take(); return !unary(); }
		return power();
	}
	function power() {
		const base = primary();
		if (peek() && peek().value === "^") { take(); return num(base) ** num(unary()); }
		return base;
	}
	function primary() {
		const t = take();
		if (t.type === "num") return t.value;
		if (t.type === "op" && t.value === "(") { const v = orExpr(); take(")"); return v; }
		if (t.type === "name") {
			if (peek() && peek().value === "(") {
				// Seules les fonctions de la liste sont accessibles (jamais les propriétés internes de JavaScript)
				const fnName = t.value.toLowerCase();
				const fn = Object.hasOwn(FUNCTIONS, fnName) ? FUNCTIONS[fnName] : null;
				if (!fn) throw new Error(`Fonction inconnue : ${t.value}()`);
				take("(");
				const args = [];
				if (peek() && peek().value !== ")") {
					args.push(orExpr());
					while (peek() && peek().value === ",") { take(); args.push(orExpr()); }
				}
				take(")");
				return fn(...args);
			}
			if (!Object.hasOwn(vars, t.value)) throw new Error(`Variable inconnue : ${t.value}`);
			return vars[t.value];
		}
		throw new Error(`Formule incorrecte : « ${source} »`);
	}

	const result = orExpr();
	if (i < tokens.length) throw new Error(`Formule incorrecte : « ${source} »`);
	return result;
}

// Remplace chaque {formule} par sa valeur ; les nombres sont écrits à la française (virgule)
function fill(text, vars) {
	return text.replace(/\{([^{}]+)\}/g, (_, expr) => {
		const value = evaluate(expr, vars);
		if (typeof value === "number") {
			if (!Number.isFinite(value)) throw new Error(`résultat impossible dans {${expr}}`);
			return formatNumber(value);
		}
		return String(value);
	});
}

// Petites retouches d'écriture : « + -3 » → « - 3 », « 1x » → « x », espaces doubles
function tidy(text) {
	return text
		.replace(/\+\s*-\s*/g, "- ")
		.replace(/-\s*-\s*/g, "+ ")
		.replace(/(^|[^\d,.])1([a-zA-Z(√])/g, "$1$2")
		.replace(/\s{2,}/g, " ")
		.trim();
}

// ---------- Tirage des variables ----------

const MAX_DRAWS = 500;

function drawOnce(variables) {
	const vars = {};
	for (const v of variables) {
		if (v.kind === "liste") {
			const value = v.values[Math.floor(Math.random() * v.values.length)];
			vars[v.name] = value;
		} else {
			let n;
			do {
				n = Math.floor(Math.random() * (v.max - v.min + 1)) + v.min;
			} while (v.nonZero && n === 0 && (v.min !== 0 || v.max !== 0));
			vars[v.name] = n;
		}
	}
	return vars;
}

// Tire des valeurs qui respectent la condition du modèle
function draw(template) {
	for (let tries = 0; tries < MAX_DRAWS; tries++) {
		const vars = drawOnce(template.variables);
		if (!template.condition || evaluate(template.condition, vars)) {
			return vars;
		}
	}
	throw new Error("Aucun tirage ne respecte la condition : élargissez les intervalles ou assouplissez la condition.");
}

// ---------- Vérification d'un modèle envoyé par le formulaire ----------

const NAME = /^[A-Za-z][A-Za-z0-9_]{0,15}$/;
const RESERVED = new Set([...Object.keys(FUNCTIONS), "et", "ou", "x"]);

function normalizeTemplate(raw) {
	if (!raw || typeof raw !== "object") throw new Error("Modèle invalide.");
	const name = String(raw.name || "").trim();
	if (!name || name.length > 80) throw new Error("Donnez un nom au modèle (80 caractères maximum).");

	const seen = new Set();
	const variables = (Array.isArray(raw.variables) ? raw.variables : []).map((v, i) => {
		const vname = String(v.name || "").trim();
		if (!NAME.test(vname)) throw new Error(`Variable ${i + 1} : le nom doit commencer par une lettre (lettres, chiffres, _).`);
		if (RESERVED.has(vname.toLowerCase())) throw new Error(`« ${vname} » est réservé : choisissez un autre nom de variable.`);
		if (seen.has(vname)) throw new Error(`La variable « ${vname} » est définie deux fois.`);
		seen.add(vname);
		if (v.kind === "liste") {
			const values = String(v.values || "").split(";").map((s) => s.trim()).filter(Boolean)
				.map((s) => (/^-?\d+([.,]\d+)?$/.test(s) ? Number(s.replace(",", ".")) : s));
			if (values.length === 0) throw new Error(`Variable « ${vname} » : donnez au moins une valeur (séparées par des ;).`);
			return { name: vname, kind: "liste", values, valuesText: String(v.values) };
		}
		const min = Number(v.min), max = Number(v.max);
		if (!Number.isInteger(min) || !Number.isInteger(max) || min > max || max - min > 100000) {
			throw new Error(`Variable « ${vname} » : il faut deux entiers avec minimum ≤ maximum.`);
		}
		return { name: vname, kind: "entier", min, max, nonZero: Boolean(v.nonZero) };
	});
	if (variables.length > 12) throw new Error("12 variables au maximum.");

	const text = (s, max) => String(s || "").trim().slice(0, max);
	const template = {
		name,
		variables,
		condition: text(raw.condition, 300),
		question: text(raw.question, 500),
		answer: text(raw.answer, 200),
		traps: (Array.isArray(raw.traps) ? raw.traps : String(raw.traps || "").split("\n"))
			.map((t) => String(t).trim()).filter(Boolean).slice(0, 10).map((t) => t.slice(0, 200)),
		tidy: raw.tidy !== false
	};
	if (!template.question) throw new Error("Écrivez l'énoncé de la question.");
	if (!template.answer) throw new Error("Écrivez la bonne réponse.");

	// Essai : le modèle doit produire une question sans erreur
	try {
		instantiate(template);
	} catch (error) {
		throw new Error("Le modèle ne fonctionne pas : " + error.message);
	}
	return template;
}

// Une question concrète : énoncé, bonne réponse, pièges, et un moyen d'en inventer d'autres
function instantiate(template) {
	const write = (s, vars) => (template.tidy ? tidy(fill(s, vars)) : fill(s, vars));
	const vars = draw(template);
	const answer = write(template.answer, vars);
	const option = (t) => ({ text: t, key: "t:" + t });
	const traps = template.traps.map((t) => {
		try { return option(write(t, vars)); } catch { return null; }
	});
	// Réponses de secours : la bonne réponse d'un autre tirage (même forme, valeurs différentes)
	const perturb = () => {
		try { return option(write(template.answer, draw(template))); } catch { return null; }
	};
	return { text: write(template.question, vars), answer: option(answer), traps, perturb };
}

// Transforme les modèles d'une catégorie en « chapitre » utilisable par le générateur de quiz
function toChapter(category, templates) {
	return {
		id: "perso-" + category.id,
		title: category.name,
		level: "Mes catégories",
		custom: true,
		types: Object.fromEntries(templates.map((t) => [String(t.id), {
			label: t.definition.name,
			// La difficulté ne change pas les tirages d'un modèle personnel
			generate: () => instantiate(t.definition)
		}]))
	};
}

// Quelques exemples de questions générées, pour l'aperçu du formulaire
function samples(template, count = 5) {
	return shuffle(Array.from({ length: count }, () => instantiate(template)))
		// Comme dans un vrai quiz : un piège identique à la bonne réponse (ou à un autre piège) n'est pas proposé
		.map((q) => ({
			text: q.text,
			answer: q.answer.text,
			traps: [...new Set(q.traps.filter(Boolean).map((t) => t.text))].filter((t) => t !== q.answer.text)
		}));
}

module.exports = { evaluate, fill, tidy, normalizeTemplate, instantiate, toChapter, samples, FUNCTIONS };
