// routes/welcomeRouter.js
const { Router } = require("express");

const welcomeRouter = Router();

const quizController = require("../controllers/quizController");

welcomeRouter.get("/", async (req, res) => {
    const quizzes = await quizController.getQuizzes();
    // Quiz commencé mais pas terminé (null sinon) : la progression reste dans la session
    const inProgress = await quizController.getCurrentQuestion(req.session);
    const dailyQuiz = await quizController.getDailyQuiz(req.session.username);
    res.render("welcome", { quizzes, inProgress, dailyQuiz, username: req.session.username, isAdmin: req.session.role === "admin" });
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

module.exports = welcomeRouter;
