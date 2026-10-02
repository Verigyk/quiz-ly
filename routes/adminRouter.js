// routes/adminRouter.js : espace professeur (réservé au rôle admin)
const { Router } = require("express");

const adminRouter = Router();

const adminController = require("../controllers/adminController");
const codeAttempts = require("../codeAttempts");

// Message affiché une seule fois après une redirection
function flash(req, type, text) {
    req.session.flash = { type, text };
}

function takeFlash(req) {
    const message = req.session.flash;
    delete req.session.flash;
    return message;
}

// Professeur connecté
const me = (req) => req.session.username;

// ---------- Élèves ----------

adminRouter.get("/", async (req, res) => {
    const students = await adminController.getStudents(me(req));
    res.render("admin/dashboard", { students, username: me(req), flash: takeFlash(req) });
});

adminRouter.post("/eleves", async (req, res) => {
    try {
        await adminController.createStudent(me(req), String(req.body.username || ""), String(req.body.password || ""));
        flash(req, "success", `Élève « ${String(req.body.username).trim()} » créé.`);
    } catch (error) {
        flash(req, "error", error.message);
    }
    res.redirect("/admin");
});

adminRouter.post("/eleves/:username/mot-de-passe", async (req, res) => {
    try {
        await adminController.setStudentPassword(me(req), req.params.username, String(req.body.password || ""));
        flash(req, "success", `Mot de passe de « ${req.params.username} » modifié.`);
    } catch (error) {
        flash(req, "error", error.message);
    }
    res.redirect("/admin");
});

// Ajouter un élève (qui a peut-être déjà d'autres professeurs) grâce à son code personnel
adminRouter.post("/eleves/code", async (req, res) => {
    try {
        codeAttempts.check(req);
        try {
            const student = await adminController.linkByCode(me(req), (req.body || {}).code);
            codeAttempts.success(req);
            flash(req, "success", `« ${student} » fait maintenant partie de vos élèves.`);
        } catch (error) {
            if (/Aucun élève/.test(error.message)) codeAttempts.fail(req);
            throw error;
        }
    } catch (error) {
        flash(req, "error", error.message);
    }
    res.redirect("/admin");
});

// Générer un code professeur à usage unique (un code précédent ne marche plus)
adminRouter.post("/code/nouveau", async (req, res) => {
    try {
        await adminController.createCode(me(req), req.body);
        flash(req, "success", "Code créé : donnez-le à un élève. Il ne servira qu'une fois.");
    } catch (error) {
        flash(req, "error", error.message);
    }
    res.redirect("/admin");
});

// Prendre en charge un élève qui n'a aucun professeur
adminRouter.post("/eleves/:username/attribuer", async (req, res) => {
    try {
        await adminController.claimStudent(me(req), req.params.username);
        flash(req, "success", `« ${req.params.username} » fait maintenant partie de vos élèves.`);
    } catch (error) {
        flash(req, "error", error.message);
    }
    res.redirect("/admin");
});

// Retirer un élève de sa liste, sans supprimer son compte
adminRouter.post("/eleves/:username/retirer", async (req, res) => {
    try {
        await adminController.unlinkStudent(me(req), req.params.username);
        flash(req, "success", `« ${req.params.username} » ne fait plus partie de vos élèves.`);
    } catch (error) {
        flash(req, "error", error.message);
    }
    res.redirect("/admin");
});

adminRouter.post("/eleves/:username/supprimer", async (req, res) => {
    try {
        await adminController.deleteStudent(me(req), req.params.username);
        flash(req, "success", `Élève « ${req.params.username} » supprimé.`);
    } catch (error) {
        flash(req, "error", error.message);
    }
    res.redirect("/admin");
});

adminRouter.get("/eleves/:username", async (req, res) => {
    const history = await adminController.getStudentHistory(me(req), req.params.username);
    if (!history) {
        return res.redirect("/admin");
    }
    const base = `/admin/eleves/${encodeURIComponent(req.params.username)}`;
    res.render("history", {
        history,
        heading: `Historique de ${req.params.username}`,
        basePath: base,
        backLink: { href: "/admin", label: "Retour à l'espace professeur" }
    });
});

adminRouter.get("/eleves/:username/:id", async (req, res) => {
    const base = `/admin/eleves/${encodeURIComponent(req.params.username)}`;
    const detail = await adminController.getStudentResult(me(req), req.params.username, Number(req.params.id));
    if (!detail) {
        return res.redirect(base);
    }
    res.render("historyDetail", { detail, backLink: { href: base, label: `Retour à l'historique de ${req.params.username}` } });
});

// ---------- Quiz du jour ----------

adminRouter.get("/quotidien", async (req, res) => {
    const [week, quizzes] = await Promise.all([
        adminController.getWeek(me(req), req.query.semaine),
        adminController.getQuizzes(me(req))
    ]);
    res.render("admin/daily", { week, quizzes, flash: takeFlash(req) });
});

adminRouter.post("/quotidien", async (req, res) => {
    try {
        await adminController.saveWeek(me(req), req.body);
        flash(req, "success", "Planning de la semaine enregistré.");
    } catch (error) {
        flash(req, "error", error.message);
    }
    const week = typeof req.body.semaine === "string" ? req.body.semaine : "";
    res.redirect("/admin/quotidien?semaine=" + encodeURIComponent(week));
});

// ---------- Quiz ----------

adminRouter.get("/quiz", async (req, res) => {
    const quizzes = await adminController.getQuizzes(me(req));
    res.render("admin/quizzes", { quizzes, me: me(req), trapModes: adminController.TRAP_MODES, flash: takeFlash(req) });
});

async function renderBuilder(req, res, quizId, saved) {
    res.render("admin/builder", {
        quizId,
        config: saved ? saved.config : null,
        students: saved ? saved.students : [],
        myStudents: await adminController.getAccessChoices(me(req)),
        catalog: await adminController.catalog(me(req)),
        trapModes: adminController.TRAP_MODES,
        limits: adminController.LIMITS
    });
}

adminRouter.get("/quiz/nouveau", (req, res) => renderBuilder(req, res, null, null));

adminRouter.get("/quiz/:id/modifier", async (req, res) => {
    const saved = await adminController.getQuizForEdit(me(req), Number(req.params.id));
    if (!saved) {
        return res.redirect("/admin/quiz");
    }
    await renderBuilder(req, res, Number(req.params.id), saved);
});

// Les routes suivantes sont appelées en JSON par la page de création
adminRouter.post("/quiz/apercu", async (req, res) => {
    try {
        res.json({ questions: await adminController.preview(me(req), req.body) });
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

async function save(req, res, id) {
    try {
        await adminController.saveQuiz(me(req), id, req.body);
        flash(req, "success", `Quiz « ${String(req.body.title).trim()} » ${id === null ? "créé" : "modifié"}.`);
        res.json({ redirect: "/admin/quiz" });
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
}

// ---------- Quiz écrits à la main ----------

async function renderManual(req, res, quizId, saved) {
    res.render("admin/manual", {
        quizId,
        quiz: saved || { title: "", description: "", questions: [], students: [] },
        myStudents: await adminController.getAccessChoices(me(req))
    });
}

adminRouter.get("/quiz/manuel/nouveau", (req, res) => renderManual(req, res, null, null));

adminRouter.get("/quiz/:id/manuel", async (req, res) => {
    const saved = await adminController.getManualQuizForEdit(me(req), Number(req.params.id));
    if (!saved) {
        return res.redirect("/admin/quiz");
    }
    await renderManual(req, res, Number(req.params.id), saved);
});

async function saveManual(req, res, id) {
    try {
        await adminController.saveManualQuiz(me(req), id, req.body);
        flash(req, "success", `Quiz « ${String(req.body.title).trim()} » ${id === null ? "créé" : "modifié"}.`);
        res.json({ redirect: "/admin/quiz" });
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
}

adminRouter.post("/quiz/manuel", (req, res) => saveManual(req, res, null));
adminRouter.post("/quiz/:id/manuel", (req, res) => saveManual(req, res, Number(req.params.id)));

adminRouter.post("/quiz", (req, res) => save(req, res, null));
adminRouter.post("/quiz/:id", (req, res) => save(req, res, Number(req.params.id)));

// Choisir les élèves qui ont accès à un quiz (y compris un quiz écrit à la main)
adminRouter.get("/quiz/:id/acces", async (req, res) => {
    const [quiz, myStudents] = await Promise.all([
        adminController.getQuizStudents(me(req), Number(req.params.id)),
        adminController.getAccessChoices(me(req))
    ]);
    if (!quiz) {
        return res.redirect("/admin/quiz");
    }
    res.render("admin/access", { quiz, myStudents });
});

adminRouter.post("/quiz/:id/acces", async (req, res) => {
    try {
        await adminController.saveQuizStudents(me(req), Number(req.params.id), (req.body || {}).students);
        flash(req, "success", "Élèves du quiz enregistrés.");
    } catch (error) {
        flash(req, "error", error.message);
    }
    res.redirect("/admin/quiz");
});

adminRouter.post("/quiz/:id/supprimer", async (req, res) => {
    try {
        await adminController.deleteQuiz(me(req), Number(req.params.id));
        flash(req, "success", "Quiz supprimé. L'historique des élèves est conservé.");
    } catch (error) {
        flash(req, "error", error.message);
    }
    res.redirect("/admin/quiz");
});

// ---------- Catégories et modèles de questions ----------

const templateController = require("../controllers/templateController");

adminRouter.get("/modeles", async (req, res) => {
    const categories = await templateController.getCategories(me(req));
    res.render("admin/templates", { categories, flash: takeFlash(req) });
});

adminRouter.post("/categories", async (req, res) => {
    try {
        await templateController.createCategory(me(req), (req.body || {}).name);
        flash(req, "success", "Catégorie créée.");
    } catch (error) {
        flash(req, "error", error.message);
    }
    res.redirect("/admin/modeles");
});

adminRouter.post("/categories/:id/renommer", async (req, res) => {
    try {
        await templateController.renameCategory(me(req), Number(req.params.id), (req.body || {}).name);
        flash(req, "success", "Catégorie renommée.");
    } catch (error) {
        flash(req, "error", error.message);
    }
    res.redirect("/admin/modeles");
});

adminRouter.post("/categories/:id/supprimer", async (req, res) => {
    try {
        await templateController.deleteCategory(me(req), Number(req.params.id));
        flash(req, "success", "Catégorie et modèles supprimés.");
    } catch (error) {
        flash(req, "error", error.message);
    }
    res.redirect("/admin/modeles");
});

async function renderTemplate(req, res, templateId, saved) {
    const categories = await templateController.getCategories(me(req));
    if (categories.length === 0) {
        flash(req, "error", "Créez d'abord une catégorie pour ranger vos modèles.");
        return res.redirect("/admin/modeles");
    }
    res.render("admin/template", {
        templateId,
        saved: saved || { category_id: Number(req.query.categorie) || categories[0].id, definition: null },
        categories,
        functions: templateController.FUNCTIONS
    });
}

adminRouter.get("/modeles/nouveau", (req, res) => renderTemplate(req, res, null, null));

adminRouter.get("/modeles/:id", async (req, res) => {
    const saved = await templateController.getTemplate(me(req), Number(req.params.id));
    if (!saved) {
        return res.redirect("/admin/modeles");
    }
    await renderTemplate(req, res, saved.id, saved);
});

// Appelées en JSON par le formulaire du modèle
adminRouter.post("/modeles/apercu", (req, res) => {
    try {
        res.json({ samples: templateController.preview(req.body) });
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

async function saveTemplate(req, res, id) {
    try {
        await templateController.saveTemplate(me(req), id, req.body);
        flash(req, "success", `Modèle « ${String(req.body.name).trim()} » enregistré.`);
        res.json({ redirect: "/admin/modeles" });
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
}

adminRouter.post("/modeles", (req, res) => saveTemplate(req, res, null));
adminRouter.post("/modeles/:id", (req, res) => saveTemplate(req, res, Number(req.params.id)));

adminRouter.post("/modeles/:id/supprimer", async (req, res) => {
    try {
        await templateController.deleteTemplate(me(req), Number(req.params.id));
        flash(req, "success", "Modèle supprimé. Les quiz qui l'utilisaient l'ignoreront.");
    } catch (error) {
        flash(req, "error", error.message);
    }
    res.redirect("/admin/modeles");
});

module.exports = adminRouter;
