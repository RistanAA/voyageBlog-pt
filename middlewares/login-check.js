const jwt = require("jsonwebtoken");
const { User } = require("../models");
const SECRET_KEY = "VOYAGE"

module.exports = async (req, res, next) => {
    const { authorization } = req.headers;
    const [authType, authToken] = (authorization || "").split(" ");

    if (!authToken || authType !== "Bearer") {
        res.status(401).send({
            errorMessage: "Login is required.",
        });
        return;
    }
    try {
        const { userId } = jwt.verify(authToken, SECRET_KEY);
        const user = await User.findByPk(userId)
        res.locals.user = user;
        next();
    } catch (err) {
        res.status(401).send({
            errorMessage: "Something error with login check",
        });
    }
};