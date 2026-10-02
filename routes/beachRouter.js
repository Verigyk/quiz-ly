// routes/beachRouter.js : la plage des compagnons
const { Router } = require("express");

const beachRouter = Router();

const beachController = require("../controllers/beachController");

beachRouter.get("/", async (req, res) => {
    const characters = await beachController.getScene(req.session.username, req.session.role);
    res.render("beach", { characters, isAdmin: req.session.role === "admin" });
});

module.exports = beachRouter;
