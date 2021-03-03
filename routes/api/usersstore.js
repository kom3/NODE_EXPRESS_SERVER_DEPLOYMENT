const express = require("express");
var router = express.Router();
var fs = require('fs');
var Users = require("../../models/users")

//@route POST api/users/saveuser
//@desc  Add user
//@access Public
router.post("/saveuser", async (req, res) => {

    try {
        if (req.session.user_login_info.role.toLowerCase() != "admin") {
            res.send({
                msg: "You are not allowed to do this operation",
                msg_type: "error"
            })
            return
        }
    } catch (error) {
        res.send({
            msg: "You are not allowed to do this operation",
            msg_type: "error"
        })
        return
    }

    const data = req.body;

    if (data.username && data.role) {
        await Users.findOne({
            username: data.username
        }, function (err, result) {
            if (err) throw err;
            if (result) {
                res.status(200).json({
                    msg: "user already added",
                    msg_type: "warning"
                });
            } else {
                const user = new Users({
                    username: req.body.username,
                    role: req.body.role,
                    profileImage: req.body.profileImage
                });
                user.save()
                    .then(item => {
                        res.status(200).json({
                            msg: "user saved to database",
                            msg_type: "success"
                        });
                    })
                    .catch(err => {
                        res.status(200).send({
                            msg: "unable to save to database",
                            msg_type: "error"
                        });
                    });
            }
        });
    } else {
        res.status(200).send({
            msg: "invalid entries",
            msg_type: "warning"
        });
    }

})

//@route GET api/users/saveuser
//@desc  GET all users 
//@access Public
router.get("/getusers", async (req, res) => {
    try {

        await Users.find({}, function (err, result) {
            if (err) throw err;
            if (result.length !== 0) {
                res.status(200).json({
                    result: result,
                    msg_type: null
                });
            } else {
                res.status(200).json({
                    msg: "no user available",
                    msg_type: "warning"
                });
            }
        });
    } catch (error) {
        res.status(200).json({
            msg: "no user available",
            msg_type: "warning"
        });
    }
})

router.all("/get_cur_users", async (req, res) => {
    try {
        if (req.session.user_login_info == null) {
            res.send({
                msg: "You are not allowed to do this operation",
                msg_type: "error"
            })
            return
        }

        Users.findOne({
            username: req.session.user_login_info.user
        }, function (err, result) {
            if (err) throw err;
            if (result!=null && result.length !== 0) {
                res.send({
                    username: req.session.user_login_info.user,
                    img:result.profileImage
                })
            }
            else{
                res.send({
                    username: req.session.user_login_info.user,
                    img:null
                })
            }
        })
    } catch (error) {
        res.send({
            username: req.session.user_login_info.user,
            img:null
        })
    }


})

//@route PUT api/users/updateusers
//@desc  Update the user
//@access Public
router.put("/updateuser", async (req, res) => {
    const data = req.body;
    if (data.username && data.role) {
        var myquery = {
            username: req.body.username
        };
        var newvalues = {
            $set: data
        };
        await Users.updateOne(myquery, newvalues, {
            new: true
        }, function (err, result) {
            if (err) throw err;
            if (result) {
                console.log("result" + result)
                res.status(200).json({
                    msg: "user updated successfully",
                    msg_type: "success"
                });
            } else {
                res.status(200).json({
                    msg: "user not found",
                    msg_type: "error"
                });
            }
        });
    } else {
        res.status(200).send({
            msg: "invalid entries",
            msg_type: "warning"
        });
    }

})



//@route DELETE api/users/updateusers
//@desc  Delete the user
//@access Public
router.delete("/deleteuser/:id", async (req, res) => {
    console.log(req.session.user_login_info)
    try {
        if (req.session.user_login_info.role.toLowerCase() != "admin") {
            res.send({
                msg: "You are not allowed to do this operation",
                msg_type: "error"
            })
            return
        }
    } catch (error) {
        res.send({
            msg: "You are not allowed to do this operation",
            msg_type: "error"
        })
        return
    }

    const data = req.params.id.toString();
    console.log(data)
    if (data) {
        await Users.deleteOne({
            _id: data
        }, function (err, result) {
            if (err) throw err;
            if (result) {
                console.log("result" + result)
                res.status(200).json({
                    msg: "user deleted successfully",
                    msg_type: "success"
                });
            } else {
                res.status(200).json({
                    msg: "user not found",
                    msg_type: "error"
                });
            }
        });
    } else {
        res.status(200).send({
            msg: "invalid entries"
        });
    }

})





module.exports = router;