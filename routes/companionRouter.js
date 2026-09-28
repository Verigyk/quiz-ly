// routes/companionRouter.js : page du compagnon et boutique
const { Router } = require("express");

const companionRouter = Router();

const companionController = require("../controllers/companionController");

// Message affiché une seule fois après une redirection
function takeFlash(req) {
    const message = req.session.companionFlash;
    delete req.session.companionFlash;
    return message;
}

companionRouter.get("/", (req, res) => {
    res.render("companion", {
        items: companionController.ITEMS,
        slots: companionController.SLOTS,
        flash: takeFlash(req),
        isAdmin: req.session.role === "admin"
    });
});

companionRouter.post("/acheter/:item", async (req, res) => {
    try {
        const { message } = await companionController.buy(req.session.username, req.params.item);
        req.session.companionFlash = { type: "success", text: message, item: req.params.item };
    } catch (error) {
        req.session.companionFlash = { type: "error", text: error.message };
    }
    res.redirect("/compagnon#boutique");
});

companionRouter.post("/porter/:item", async (req, res) => {
    try {
        await companionController.wear(req.session.username, req.params.item, req.body.on === "1");
    } catch (error) {
        req.session.companionFlash = { type: "error", text: error.message };
    }
    res.redirect("/compagnon#tenues");
});

companionRouter.post("/prenom", async (req, res) => {
    try {
        const name = await companionController.rename(req.session.username, req.body.name);
        req.session.companionFlash = { type: "success", text: `${name} ? J'adore ce prénom !` };
    } catch (error) {
        req.session.companionFlash = { type: "error", text: error.message };
    }
    res.redirect("/compagnon");
});

companionRouter.post("/visibilite", async (req, res) => {
    await companionController.setVisible(req.session.username, req.body.visible === "1");
    res.redirect(req.get("Referer") || "/compagnon");
});

module.exports = companionRouter;
