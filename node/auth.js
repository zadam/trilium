function checkAuth(req, res, next) {
    if (!req.session.loggedIn) {
        res.redirect("login");
    } else {
        next();
    }
}

function checkApiAuth(req, res, next) {
    if (!req.session.loggedIn) {
        res.sendStatus(401);
    } else {
        next();
    }
}

module.exports = {
    checkAuth,
    checkApiAuth
};