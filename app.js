const express = require("express");
const app = express();

const path = require("node:path");

const assetsPath = path.join(__dirname, "public");
app.use(express.static(assetsPath));

app.use(express.urlencoded({ extended: true }));
app.use(express.json());

const session = require("express-session");
app.use(session({
    secret: "quiz-secret",
    resave: false,
    saveUninitialized: false
}));

app.set("views", path.join(__dirname, "views"));
app.set("view engine", "ejs");

// Nom du site affiché sur toutes les pages
app.locals.siteName = "Maths en quiz";

// Phrase du compagnon, utilisable dans les vues
app.locals.companionLine = require("./companion").line;

const indexRouter = require("./routes/indexRouter");
const welcomeRouter = require("./routes/welcomeRouter");
const quizRouter = require("./routes/quizRouter");
const adminRouter = require("./routes/adminRouter");
const companionRouter = require("./routes/companionRouter");
const companionController = require("./controllers/companionController");

app.use("/", indexRouter);
// Redirige vers la page de connexion si personne n'est connecté
function requireLogin(req, res, next) {
    if (!req.session.username) {
        return res.redirect("/");
    }
    next();
}

// Charge le compagnon et les points de l'élève pour toutes ses pages
async function loadCompanion(req, res, next) {
    res.locals.companion = await companionController.load(req.session.username);
    next();
}

app.use("/accueil", requireLogin, loadCompanion, welcomeRouter);
app.use("/compagnon", requireLogin, loadCompanion, companionRouter);
// Espace professeur : réservé aux comptes admin
function requireAdmin(req, res, next) {
    if (req.session.role !== "admin") {
        return res.redirect(req.session.username ? "/accueil" : "/");
    }
    next();
}

app.use("/quiz", requireLogin, loadCompanion, quizRouter);
app.use("/admin", requireAdmin, adminRouter);

const PORT = 3000;
app.listen(PORT, (error) => {
    // This is important!
    // Without this, any startup errors will silently fail
    // instead of giving you a helpful error message.
    if (error) {
        throw error;
    }
    console.log(`Quiz website listening on ${PORT}!`);
});