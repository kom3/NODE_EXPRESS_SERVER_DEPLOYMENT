const express = require("express");
var router = express.Router();
var fs = require('fs');
var ObjectID = require('mongodb').ObjectID;

module.exports = router;

//midlware for making global session
router.use((req, res, next) => {
    if (typeof (req.session.user_login_info) == "undefined")
        req.session.user_login_info = {}
    console.log(`-------API--${req.url}-------${JSON.stringify(req.session.user_login_info)}----------${new Date()}----------------------------`)
    next();
});


router.get("/test_access", async (req, res) => {
    try {
        if (req.session.user_login_info && req.session.user_login_info.role) {
            if (req.session.user_login_info.role.toLowerCase() == "admin") {
                res.send({
                    msg: "You have access to all because u r admin",
                    msg_type: "error"
                })
            }
            else if(req.session.user_login_info.role.toLowerCase() == "standard_user"){
                res.send({
                    msg: "You have  limited access because u r standard_user",
                    msg_type: "error"
                })
            }
            else{
                res.send({
                    msg: "You don't have access because u r not either admin or standard_user",
                    msg_type: "error"
                })
            }
        }
        else{
            res.send({
                msg: "User not logged in",
                msg_type: "error"
            })
        }

    } catch (error) {
        res.send({
            msg: "You are not allowed because some server error",
            msg_type: "error"
        })
    }

})