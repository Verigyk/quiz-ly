// Catégories et modèles de questions personnels des professeurs
const db = require("../db");
const custom = require("../generators/custom");

// Les catégories d'un professeur, transformées en chapitres pour le générateur de quiz
async function chaptersFor(owner) {
	const categories = await db.getCategories(owner);
	return categories.filter((c) => c.templates.length > 0).map((c) => custom.toChapter(c, c.templates));
}

// Chapitres personnels utilisés par une configuration de quiz (celle d'un autre professeur possiblement :
// un élève lance le quiz de son professeur)
async function chaptersForConfig(config) {
	const ids = [...new Set((config.items || [])
		.filter((it) => String(it.chapter).startsWith("perso-"))
		.map((it) => Number(it.type))
		.filter(Number.isInteger))];
	const rows = await db.getTemplatesByIds(ids);
	const byCategory = new Map();
	for (const row of rows) {
		if (!byCategory.has(row.category_id)) {
			byCategory.set(row.category_id, { category: { id: row.category_id, name: row.category_name }, templates: [] });
		}
		byCategory.get(row.category_id).templates.push(row);
	}
	return [...byCategory.values()].map(({ category, templates }) => custom.toChapter(category, templates));
}

// ---------- Catégories ----------

function checkName(name) {
	name = String(name || "").normalize("NFC").trim();
	if (!name || name.length > 60) {
		throw new Error("Le nom de la catégorie doit faire entre 1 et 60 caractères.");
	}
	return name;
}

async function getCategories(owner) {
	return db.getCategories(owner);
}

async function createCategory(owner, name) {
	try {
		return await db.createCategory(owner, checkName(name));
	} catch (error) {
		if (error.code === "23505") throw new Error("Vous avez déjà une catégorie de ce nom.");
		throw error;
	}
}

async function renameCategory(owner, id, name) {
	try {
		if (!(await db.renameCategory(owner, id, checkName(name)))) throw new Error("Catégorie introuvable.");
	} catch (error) {
		if (error.code === "23505") throw new Error("Vous avez déjà une catégorie de ce nom.");
		throw error;
	}
}

async function deleteCategory(owner, id) {
	if (!(await db.deleteCategory(owner, id))) throw new Error("Catégorie introuvable.");
}

// ---------- Modèles ----------

async function getTemplate(owner, id) {
	return db.getTemplate(owner, id);
}

async function saveTemplate(owner, id, body) {
	const categoryId = Number(body.categoryId);
	if (!(await db.ownsCategory(owner, categoryId))) {
		throw new Error("Choisissez une de vos catégories (créez-en une si besoin).");
	}
	const definition = custom.normalizeTemplate(body);
	if (id === null) {
		return db.createTemplate(owner, categoryId, definition);
	}
	if (!(await db.updateTemplate(owner, id, categoryId, definition))) {
		throw new Error("Modèle introuvable.");
	}
	return id;
}

async function deleteTemplate(owner, id) {
	if (!(await db.deleteTemplate(owner, id))) throw new Error("Modèle introuvable.");
}

// Exemples de questions pour le bouton « Tester » (rien n'est enregistré)
function preview(body) {
	return custom.samples(custom.normalizeTemplate(body), 6);
}

module.exports = {
	chaptersFor,
	chaptersForConfig,
	getCategories,
	createCategory,
	renameCategory,
	deleteCategory,
	getTemplate,
	saveTemplate,
	deleteTemplate,
	preview,
	FUNCTIONS: Object.keys(custom.FUNCTIONS)
};
