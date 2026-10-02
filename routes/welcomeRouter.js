// routes/welcomeRouter.js
const { Router } = require("express");

const welcomeRouter = Router();

const quizController = require("../controllers/quizController");
const codeAttempts = require("../codeAttempts");

welcomeRouter.get("/", async (req, res) => {
    const quizzes = await quizController.getQuizzes(req.session.username);
    // Quiz commencé mais pas terminé (null sinon) : la progression reste dans la session
    const inProgress = await quizController.getCurrentQuestion(req.session);
    const dailyQuizzes = await quizController.getDailyQuizzes(req.session.username);
    res.render("welcome", { quizzes, inProgress, dailyQuizzes, username: req.session.username, isAdmin: req.session.role === "admin" });
});

welcomeRouter.get("/historique", async (req, res) => {
    const history = await quizController.getHistory(req.session.username);
    res.render("history", {
        history,
        heading: "Mon historique",
        basePath: "/accueil/historique",
        backLink: { href: "/accueil", label: "Retour à l'accueil" }
    });
});

welcomeRouter.get("/historique/:id", async (req, res) => {
    const detail = await quizController.getResultDetail(Number(req.params.id), req.session.username);
    if (!detail) {
        return res.redirect("/accueil/historique");
    }
    res.render("historyDetail", { detail, backLink: { href: "/accueil/historique", label: "Retour à l'historique" } });
});

// ---------- Mes professeurs : code personnel et rejoindre un professeur ----------

function takeFlash(req) {
    const message = req.session.teachersFlash;
    delete req.session.teachersFlash;
    return message;
}

welcomeRouter.get("/professeurs", async (req, res) => {
    const { teachers, code } = await quizController.getMyTeachers(req.session.username);
    res.render("teachers", { teachers, code, flash: takeFlash(req), isAdmin: req.session.role === "admin" });
});

welcomeRouter.post("/professeurs", async (req, res) => {
    try {
        codeAttempts.check(req);
        try {
            const teacher = await quizController.joinTeacher(req.session.username, (req.body || {}).code);
            codeAttempts.success(req);
            req.session.teachersFlash = { type: "success", text: `Tu fais maintenant partie des élèves de ${teacher} !` };
        } catch (error) {
            if (/Aucun professeur/.test(error.message)) codeAttempts.fail(req);
            throw error;
        }
    } catch (error) {
        req.session.teachersFlash = { type: "error", text: error.message };
    }
    res.redirect("/accueil/professeurs");
});

welcomeRouter.post("/professeurs/:teacher/quitter", async (req, res) => {
    try {
        await quizController.leaveTeacher(req.session.username, req.params.teacher);
        req.session.teachersFlash = { type: "success", text: `Tu ne fais plus partie des élèves de ${req.params.teacher}.` };
    } catch (error) {
        req.session.teachersFlash = { type: "error", text: error.message };
    }
    res.redirect("/accueil/professeurs");
});

welcomeRouter.post("/code/nouveau", async (req, res) => {
    try {
        await quizController.createMyCode(req.session.username, req.body);
        req.session.teachersFlash = { type: "success", text: "Code créé : donne-le à ton professeur. Il ne servira qu'une fois." };
    } catch (error) {
        req.session.teachersFlash = { type: "error", text: error.message };
    }
    res.redirect("/accueil/professeurs");
});

module.exports = welcomeRouter;
