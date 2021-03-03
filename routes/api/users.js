const express = require('express');
const router = express.Router();

module.exports = router;


// gateway api which hits first before passing to actual API
// used for some variable initializations
router.use((req, res, next) => {
    // // console.log(req.body)
    if (typeof (req.session.user_login_info) == "undefined")
        req.session.user_login_info = {}
    next();
})

router.post("/login", async (req, res) => {
    console.warn(req.body)
    const data = req.body;
    if (data.username && data.password) {
        req.session.user_login_info = {
            user: data.username,
            token: "some static token",
            role: "standard_user",
        }
        res.send("logged in as standard user")
    } else{
        req.session.user_login_info = {
            user: data.username,
            role: "admin",
        }
        res.send("logged in as admin")
    }
        
})


router.all("/logout", async (req, res) => {
    req.session.user_login_info = null
    req.session.cur_log_path = "-1"
    res.send("done")

})

router.all("/login_status", async (req, res) => {
    if (typeof (req.session.user_login_info) != "undefined" && req.session.user_login_info != null && req.session.user_login_info.role != null) {
        res.send(req.session.user_login_info.role)
    } else
        res.send("not logged in")
})
