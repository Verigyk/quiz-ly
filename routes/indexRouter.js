
// routes/authorRouter.js
const { Router } = require("express");

const indexRouter = Router();

const accountController = require("../controllers/accountController");

indexRouter.get("/", (req, res) => {
    const error = req.session.loginError;
    delete req.session.loginError;
    res.render("index", { error });
});

indexRouter.post("/connection", async (req, res) => {
    let username = String(req.body.username || "").normalize("NFC").trim();
    let password = String(req.body.password || "").normalize("NFC");

    try {
        const user = await accountController.authentification(username, password);
        req.session.username = user.username;
        req.session.role = user.role;
        res.redirect(user.role === "admin" ? "/admin" : "/accueil");
    } catch (error) {
        console.log(error.message);
        req.session.loginError = true;
        res.redirect("/");
    }

});

// Détruit la session : l'utilisateur n'est plus connecté et le quiz en cours est oublié
indexRouter.post("/logout", (req, res, next) => {
    req.session.destroy((error) => {
        if (error) {
            return next(error);
        }
        res.clearCookie("connect.sid");
        res.redirect("/");
    });
});

module.exports = indexRouter;