// routes/quizRouter.js
const { Router } = require("express");

const quizRouter = Router();

const quizController = require("../controllers/quizController");

quizRouter.post("/:id/start", async (req, res) => {
    try {
        await quizController.startQuiz(req.session, Number(req.params.id));
        res.redirect("/quiz/question");
    } catch (error) {
        console.log(error.message);
        res.redirect("/accueil");
    }
});

quizRouter.get("/question", async (req, res) => {
    const question = await quizController.getCurrentQuestion(req.session);
    if (!question) {
        return res.redirect("/quiz/result");
    }
    const feedback = req.session.feedback;
    delete req.session.feedback;
    res.render("quiz", { question, feedback });
});

quizRouter.post("/submitAnswer", async (req, res) => {
    try {
        req.session.feedback = await quizController.submitAnswer(req.session, req.body.reponse);
        res.redirect("/quiz/question");
    } catch (error) {
        console.log(error.message);
        res.redirect("/accueil");
    }
});

quizRouter.get("/result", async (req, res) => {
    const result = await quizController.getResult(req.session);
    if (!result) {
        return res.redirect("/accueil");
    }
    const feedback = req.session.feedback;
    delete req.session.feedback;
    res.render("result", { result, feedback });
});

module.exports = quizRouter;
