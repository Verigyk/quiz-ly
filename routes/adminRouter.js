// routes/adminRouter.js : espace professeur (réservé au rôle admin)
const { Router } = require("express");

const adminRouter = Router();

const adminController = require("../controllers/adminController");

// Message affiché une seule fois après une redirection
function flash(req, type, text) {
    req.session.flash = { type, text };
}

function takeFlash(req) {
    const message = req.session.flash;
    delete req.session.flash;
    return message;
}

// ---------- Élèves ----------

adminRouter.get("/", async (req, res) => {
    const students = await adminController.getStudents();
    res.render("admin/dashboard", { students, username: req.session.username, flash: takeFlash(req) });
});

adminRouter.post("/eleves", async (req, res) => {
    try {
        await adminController.createStudent(String(req.body.username || ""), String(req.body.password || ""));
        flash(req, "success", `Élève « ${req.body.username.trim()} » créé.`);
    } catch (error) {
        flash(req, "error", error.message);
    }
    res.redirect("/admin");
});

adminRouter.post("/eleves/:username/mot-de-passe", async (req, res) => {
    try {
        await adminController.setStudentPassword(req.params.username, String(req.body.password || ""));
        flash(req, "success", `Mot de passe de « ${req.params.username} » modifié.`);
    } catch (error) {
        flash(req, "error", error.message);
    }
    res.redirect("/admin");
});

adminRouter.post("/eleves/:username/supprimer", async (req, res) => {
    await adminController.deleteStudent(req.params.username);
    flash(req, "success", `Élève « ${req.params.username} » supprimé.`);
    res.redirect("/admin");
});

adminRouter.get("/eleves/:username", async (req, res) => {
    const history = await adminController.getStudentHistory(req.params.username);
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
    const detail = await adminController.getStudentResult(req.params.username, Number(req.params.id));
    if (!detail) {
        return res.redirect(base);
    }
    res.render("historyDetail", { detail, backLink: { href: base, label: `Retour à l'historique de ${req.params.username}` } });
});

// ---------- Quiz du jour ----------

adminRouter.get("/quotidien", async (req, res) => {
    const [week, quizzes] = await Promise.all([
        adminController.getWeek(req.query.semaine),
        adminController.getQuizzes()
    ]);
    res.render("admin/daily", { week, quizzes, flash: takeFlash(req) });
});

adminRouter.post("/quotidien", async (req, res) => {
    try {
        await adminController.saveWeek(req.body);
        flash(req, "success", "Planning de la semaine enregistré.");
    } catch (error) {
        flash(req, "error", error.message);
    }
    const week = typeof req.body.semaine === "string" ? req.body.semaine : "";
    res.redirect("/admin/quotidien?semaine=" + encodeURIComponent(week));
});

// ---------- Quiz ----------

adminRouter.get("/quiz", async (req, res) => {
    const quizzes = await adminController.getQuizzes();
    res.render("admin/quizzes", { quizzes, trapModes: adminController.TRAP_MODES, flash: takeFlash(req) });
});

function renderBuilder(res, quizId, config) {
    res.render("admin/builder", {
        quizId,
        config,
        catalog: adminController.catalog(),
        trapModes: adminController.TRAP_MODES,
        limits: adminController.LIMITS
    });
}

adminRouter.get("/quiz/nouveau", (req, res) => renderBuilder(res, null, null));

adminRouter.get("/quiz/:id/modifier", async (req, res) => {
    const config = await adminController.getQuizConfig(Number(req.params.id));
    if (!config) {
        return res.redirect("/admin/quiz");
    }
    renderBuilder(res, Number(req.params.id), config);
});

// Les routes suivantes sont appelées en JSON par la page de création
adminRouter.post("/quiz/apercu", (req, res) => {
    try {
        res.json({ questions: adminController.preview(req.body) });
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

async function save(req, res, id) {
    try {
        await adminController.saveQuiz(id, req.body);
        flash(req, "success", `Quiz « ${String(req.body.title).trim()} » ${id === null ? "créé" : "modifié"}.`);
        res.json({ redirect: "/admin/quiz" });
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
}

adminRouter.post("/quiz", (req, res) => save(req, res, null));
adminRouter.post("/quiz/:id", (req, res) => save(req, res, Number(req.params.id)));

adminRouter.post("/quiz/:id/supprimer", async (req, res) => {
    await adminController.deleteQuiz(Number(req.params.id));
    flash(req, "success", "Quiz supprimé. L'historique des élèves est conservé.");
    res.redirect("/admin/quiz");
});

module.exports = adminRouter;
