const express = require("express");
var router = express.Router();
var fs = require('fs');
var report = require("../../models/test_report")
var mapping = require("../../models/report_mapping")
var jobs = require(`../../models/job_files`)
const status_report = require('../../models/status_report');
const log_tree = require('../../models/log_tree');
var dict = require(`../../models/dictionary`)
const StreamZip = require('node-stream-zip');
var ObjectID = require('mongodb').ObjectID;
var convert = require('xml-js');
var jsonQuery = require('json-query')
var cron = require('node-cron');

bug_report_path = '/dashboard/reports/'


const {
    fork
} = require('child_process');


const {
    spawn
} = require("child_process");

readfile_child = fork(`${__dirname}/readfile_thread.js`);
//  source /auto/pyats/bin/lab_proxy.sh
//  pm2 restart server.js --node-args="--max-old-space-size=6000"
// pm2 restart server2.js --node-args="--max-old-space-size=6000"




cron.schedule("0 0 6 * * *", () => {
    console.log("------Job started at: ", new Date());
    readlogs_bg(86400 * 30);
    console.log("------Job ended at: ", new Date());
}, {
    scheduled: true,
    timezone: "Asia/Kolkata"
});

cron.schedule("0 0 12 * * *", () => {
    console.log("------Job started at: ", new Date());
    readlogs_bg(86400 * 30);
    console.log("------Job ended at: ", new Date());
}, {
    scheduled: true,
    timezone: "Asia/Kolkata"
});

cron.schedule("0 0 18 * * *", () => {
    console.log("------Job started at: ", new Date());
    readlogs_bg(86400 * 30);
    console.log("------Job ended at: ", new Date());
}, {
    scheduled: true,
    timezone: "Asia/Kolkata"
});

// cron.schedule('* * * * *', () => {
//     readlogs_bg(86400*50)
//   });
cron.schedule('0 0 0 * * *', () => {
    readlogs_bg(86400 * 360)
    // delete_old_reports(90);
}, {
    scheduled: true,
    timezone: "Asia/Kolkata"
});

//midlware for making global session
router.use((req, res, next) => {
    // // console.log(req.body)
    if (typeof (req.session.processed_zip_files) == "undefined")
        req.session.processed_zip_files = 0
    if (typeof (req.session.total_zip_files) == "undefined")
        req.session.total_zip_files = 0
    if (typeof (req.session.user_login_info) == "undefined")
        req.session.user_login_info = {}
    if (typeof (req.session.cur_log_path) == "undefined")
        req.session.cur_log_path = "-1"
    console.log(`-------API--${req.url}-------${JSON.stringify(req.session.user_login_info)}----------${new Date()}----------------------------`)
    log_to_file(`-------API--${req.url}-------${JSON.stringify(req.session.user_login_info)}----------${new Date()}----------------------------`)
    next();
});



readlogs_bg = (seconds = 3600, req = null, res = null, timeout = null) => {
    if (res != null) {
        res.set({
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache',
            'Connection': 'keep-alive'
        });
    }
    readfile_child.send({
        seconds: seconds
    });
    read_bg_timout = null
    if (timeout != null) {
        read_bg_timout = setTimeout(() => {
            if (res != null) {
                res.write(`data: {"perc":100} \n\n`)
                res.flush();
                res.end()
            }
            clearTimeout(read_bg_timout)
        }, timeout);
    }

    let local_count = 0;
    readfile_child.on("message", handler = (msg) => {
        msg.local_count = local_count
        let data = {
            perc: msg.local_count / msg.total * 100,
            file: msg.path
        }
        console.log(msg)
        log_to_file(JSON.stringify(data))
        if (msg.total != null && res != null) {
            res.write(`data: ${JSON.stringify(data)} \n\n`)
            res.flush();
            clearTimeout(read_bg_timout)
            // if (read_bg_timout != null && timeout != null) {
            //     clearTimeout(read_bg_timout)
            //     read_bg_timout = setTimeout(() => {
            //         res.write(`data: {"perc":100} \n\n`)
            //         res.flush();
            //         res.end()
            //         clearTimeout(read_bg_timout)
            //     }, 20000);
            // }
        }
        try {
            if (msg.total <= msg.local_count) {
                // read_bg_timout.removeListener('message', handler);
                if (res != null)
                    res.end()
            }
        } catch (error) {
            console.log(err)
        }
        local_count++;
    })
}




router.all("/readlogs", read_lg = async (req, res) => {
    readlogs_bg(86400 * 50, req, res, 5000)
})

router.all("/getip", (req, res, next) => {
    var ip = require("ip");
    res.send(ip.address())
})



require('streammagic')();
JSONStream = require('JSONStream')

router.all("/getdata", async (req, res) => {
    if (!(typeof (req.session.user_login_info) != "undefined" && req.session.user_login_info != null)) {
        res.send({
            msg: "You are not allowed to do this operation",
            msg_type: "error"
        })
        return
    }
    try {
        let where = {}
        where.sanity = {
            $ne: null
        }
        where.branch = {
            $ne: null
        }
        where.platform = {
            $ne: null
        }
        where.test_type = {
            $ne: null
        }
        // console.log("req.body", req.body)
        if (req.body.archive_path == null && (req.session.cur_log_path != null && req.session.cur_log_path != "-1"))
            where.archive_path = {
                $regex: `.*${req.session.cur_log_path}.*`
            }
        for (let key in req.body) {
            if (req.body[key] == "-1" || req.body[key] == -1)
                continue
            if (key == "pattern") {
                JSON.parse(req.body[key]).map((pair) => where[pair.key] = pair.exp)
                continue
            }
            if (key == "period") {
                let period = req.body[key]
                console.log(new Date(new Date().getTime() - Number(period.milsecs)))
                if (Number(period.milsecs) > 0)
                    where[period.field] = {
                        $gt: new Date(new Date().getTime() - Number(period.milsecs)).getTime()
                    }
                else
                    where[period.field] = {
                        $lt: new Date(new Date().getTime() - Number(period.milsecs)).getTime()
                    }
                continue
            }
            where[key] = req.body[key]
            if (req.body[key] == "" || req.body[key] == null || req.body[key] == "-")
                where[key] = null
        }


        where.format_satisfied = true
        where.start_time = { $gte: new Date().getTime() - (1000 * 60 * 60 * 24 * 90) }

        console.log("where", where)
        console.log(`---start ${new Date()}`)
        // report.find({
        //     $query: where,
        //     $orderby: {
        //         build: -1
        //     }
        // })
        res.set('Content-Type', 'application/json')

        let stream = report.aggregate([{
            $lookup: {
                from: 'report_maps',
                // localField: "job", // field in the orders collection
                // foreignField: "job",
                let: {
                    job_name: "$job",
                    build_number: "$build",
                    version_number: "$version"
                },

                pipeline: [{
                    $match: {
                        $and: [{
                            $expr: {
                                $eq: ["$job", "$$job_name"],
                            }
                        }, {
                            $expr: {
                                $or: [
                                    { $regexMatch: { input: "$$build_number", regex: { $concat: ["^", "$version", ".*"] }, options: "i" } },
                                    { $eq: ["$sanity", "nova"] }
                                ]
                            }
                        }
                        ]
                    }
                }

                ],
                as: "fromItems",
            },
        },
        {

            $replaceRoot: {
                newRoot: {
                    $mergeObjects: [{
                        $arrayElemAt: ["$fromItems", 0]
                    }, "$$ROOT"]
                }
            }

        },
        {
            $unwind: "$branch"
        },
        {
            $project: {
                fromItems: 0
            }
        },
        { $addFields: { build: { $cond: [{ $eq: ["$sanity", "nova"] }, "$version", "$build"] } } },
        {
            $match: where
        },
        {
            $sort: {
                "priority": 1,
                "build": -1,
                "stop_time": -1
            }
        }
        ]).allowDiskUse(true)
            // .cursor({ batchSize: 100000000 })
            .exec()
            // .pipe(JSONStream.stringify()).pipe(res);

            // let chunks="["
            // chunks.toStream().pipe(res); 
            //     let data = []
            //      stream.eachAsync(async (chunk) => {
            //         // console.log(chunk.job)
            //         data.push(chunk)
            //         //   chunks+=JSON.stringify(chunk)+",\n"
            //         //   chunks.toStream().pipe(res);   
            //     });
            //     // //   chunks+="]"
            //     // //   chunks.toStream().pipe(res);   
            //     // //   res.end()
            //    res.send(data)


            //reason i used this method,it will compress reponce(Ex:60Mb json -> 1.4Mb) so ti
            .then(function (data) {
                // res.send({
                //     json_data: data,
                //     user: req.session.user
                // });
                res.send(data)

            });


        console.log(`---end ${new Date()}`)




    } catch (error) {
        console.log(error)
        // res.status(500).json({
        //     msg: error.message
        // })
    }

})

router.all("/getjobs", (req, res) => {
    console.log("getting jobs...")
    try {
        mapping.find().sort({
            priority: 1
        }).sort({
            job: 1
        }).then(function (data) {
            res.send({
                json_data: data,
                user: req.session.user_login_info
            });
        })
    } catch (error) {
        res.status(500).json({
            msg: error.message
        })
    }

})

router.post("/update_data", async (req, res) => {

    try {
        if (req.session.user_login_info.role.toLowerCase() == "guest") {
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


    console.log(req.body)
    let where = req.body.where
    if (typeof (where._id) != "undefined")
        where._id = ObjectID(where._id)
    let update_data = {}
    for (var key in req.body.update_data)
        update_data[key] = JSON.parse(req.body.update_data[key])
    console.log("update_data", update_data, where)
    let status = {}
    try {
        status.status = await report.updateMany({ _id: where._id }, {
            $set: update_data
        });
        status.type = "success"
    } catch (error) {
        status.error = error.message
        status.type = "error"
    }

    if (status.status && status.status.nModified) {

        report.findById(where._id, async function (err, data) {
            if (err || data == null) {
                return
            }

            let task_ids = []
            let task_v_name_ln = task_v_id_ln = task_v_result_ln = 0;
            for (let task in data.task_ids) {
                let task_v = data.task_ids[task]
                if (task_v.name.length > task_v_name_ln)
                    task_v_name_ln = task_v.name.length
                if (task_v.id.length > task_v_id_ln)
                    task_v_id_ln = task_v.id.length
                if (task_v.result.length > task_v_result_ln)
                    task_v_result_ln = task_v.result.length

            }

            task_ids.push(`Name ${" ".repeat(task_v_name_ln - "Name".length)}\tId ${" ".repeat(task_v_id_ln - "Id".length)}\tResult ${" ".repeat(task_v_result_ln - "Result".length)}\tBug Ids`)

            for (let task in data.task_ids) {
                let task_v = data.task_ids[task]
                task_ids.push(`${task_v.name} ${" ".repeat(task_v_name_ln - task_v.name.length)}\t${task_v.id} ${" ".repeat(task_v_id_ln - task_v.id.length)}\t${task_v.result} ${" ".repeat(task_v_result_ln - task_v.result.length)}\t${task_v.bug_ids.join(",")}`)
            }


            let txt = `
id          : ${data.id}
job         : ${data.job}
build       : ${data.build}
sanity      : ${where.sanity}
test_type   : ${where.test_type}
branch      : ${where.branch}
platfrom    : ${where.platform}
user        : ${data.user}
runtime     : ${data.runtime}
success_rate: ${data.success_rate}
total       : ${data.total}
passed      : ${data.passed}
failed      : ${data.failed}
skipped     : ${data.skipped}
aborted     : ${data.aborted}
error       : ${data.error}
start_time  : ${data.start_time}
            

${task_ids.join("\n")} `
            let filename = data.archive_file.split(".").slice(0, -1).join(".") + ".txt"
            fs.promises.mkdir(bug_report_path, { recursive: true }).catch(error => console.log(error));
            fs.writeFileSync(bug_report_path + filename, txt);
            await report.updateMany({ _id: where._id }, {
                $set: { bug_id: bug_report_path + filename }
            });
        })


    }
    console.log("status", status)
    res.set('Content-Type', 'text/html');
    res.send(status)
})

router.all("/get_task_ids", async (req, res) => {

    try {
        if (req.session.user_login_info.role.toLowerCase() == "guest") {
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
    try {
        report.findById(ObjectID(req.body.id), function (err, data) {
            if (err || data == null) {
                res.send([])
                return
            }
            res.send(data.task_ids)
        });
    } catch (error) {
        res.send([])
    }

})

router.post("/update_mapping_data", async (req, res) => {
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

    console.log(req.body)
    let where = req.body.where
    if (typeof (where._id) != "undefined")
        where._id = ObjectID(where._id)
    let update_data = {}
    for (var key in req.body.update_data)
        update_data[key] = JSON.parse(req.body.update_data[key])
    // console.log("update_data",update_data, where)
    let status = {}
    try {
        status.status = await mapping.updateMany(where, {
            $set: update_data
        });
        status.type = "success"
    } catch (error) {
        status.error = error.message
        status.type = "error"
    }
    console.log("status", status)
    res.set('Content-Type', 'text/html');
    res.send(status)
})

var nodemailer = require('nodemailer');
var transporter = nodemailer.createTransport({
    host: "smtp.gmail.com",
    port: 587,
    secure: false,
    auth: {
        user: 'terralogic.smarthire@gmail.com',
        pass: 'pfimeomavfaltbtt'
    }
});



router.post("/update_mapping", async (req, res) => {
    try {
        if (req.session.user_login_info.role.toLowerCase() == "guest") {
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


    let resp = []
    for (let key in req.body.data) {
        let status = {}
        // if(req.body.data[key].version=="" || req.body.data[key].version==null)
        //     continue;        
        let data = {
            job: req.body.data[key].job,
            platform: req.body.data[key].platform,
            sanity: req.body.data[key].sanity,
            version: req.body.data[key].version,
            branch: req.body.data[key].branch,
            test_type: req.body.data[key].test_type
        }
        console.log(data, req.body.data[key].id)
        if (req.body.data[key].id == null && req.body.data[key].job != "") {
            console.log("inserting,..", data.job)
            try {
                const map = new mapping(data);
                await map.save().then((res, err) => {
                    console.log(res._id)
                    if (err) throw err
                    status.id = res._id
                    status.job = res.job

                });
                status.type = "success"
                status.status = "Successfully added"

            } catch (error) {
                status.type = "error"
                status.status = "Failed to add"
            }

        } else {
            try {
                console.log("Updating,..", data.job)
                status.status = await mapping.updateMany({
                    _id: ObjectID(req.body.data[key].id)
                }, {
                    $set: data
                });
                status.type = "success"
                console.log("status", status)
            } catch (error) {
                console.log(error)
                status.error = error.message
                status.type = "error"
            }
        }
        resp.push(status)
    }
    res.send(resp)
})



router.post("/bulk_update_mapping", async (req, res) => {
    console.log("...bulk_update_mapping")
    try {
        if (req.session.user_login_info.role.toLowerCase() == "guest") {
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

    // console.log(req.body)

    let resp = []
    for (let key in req.body.data) {
        let status = {}
        // if(req.body.data[key].version=="" || req.body.data[key].version==null)
        //     continue;        
        let data = {
            job: req.body.data[key].job,
            platform: req.body.data[key].platform,
            sanity: req.body.data[key].sanity,
            version: req.body.data[key].version,
            branch: req.body.data[key].branch,
            test_type: req.body.data[key].test_type
        }


        const map = new mapping(data);
        await map.save().then((res, err) => {
            if (err) console.log(err)
        })
    }

    res.send("done")

})


router.post("/remove_mapping", async (req, res) => {
    try {
        if (req.session.user_login_info.role.toLowerCase() == "guest") {
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
    }
    try {
        await mapping.deleteOne({
            _id: req.body.id
        }, function (err, result) {
            if (err) throw err;
            if (result) {
                console.log(result)
                res.send("deleted")
            }
        })
    } catch (error) {
        console.log(error)
        res.send("Failed")
    }

})




send_email2 = async (user, to, subject, text = null, html = null) => {
    var mailOptions = {
        from: 'terralogic.smarthire@gmail.com',
        to: to,
        subject: subject,
    };

    if (text != null)
        mailOptions["text"] = text
    if (html != null)
        mailOptions["html"] = html

    return await new Promise((resolve) => transporter.sendMail(mailOptions, async function (error, info) {
        if (error) {
            console.log(error);
            resolve({
                msg: "Failed to send",
                msg_type: "error"
            })
            return
        } else {
            console.log('Email sent: ' + info.response);
            resolve({
                msg: "sent",
                msg_type: "success"
            })
        }
    }));
}


send_mail = async (user, to, subject, text = null, html = null) => {

    console.log("sending mail....", user, to, subject)

    return await new Promise((resolve) => {
        let msg = `To: ${to}
MIME-Version: 1.0
Subject: ${subject}
Content-Type: text/html

${text != null ? "<pre>" + text + "</pre>" : ""}
<p>
${html != null ? html : ""}
</p>`

        const cmd = spawn(`su - ${user} -c \'sendmail -vt <<EOF ${msg}\nEOF\'`, { shell: true });
        cmd.stdout.on("data", data => {
            console.log(`stdout: ${data}`);
            resolve({
                msg: "sent",
                msg_type: "success"
            })
        });

        cmd.stderr.on("data", data => {
            console.log(`stderr: ${data}`);
            resolve({
                msg: "Failed to send",
                msg_type: "error"
            })
            // resolve(send_email2(to, subject, text, html))
        });

        cmd.on('error', (error) => {
            console.log(`error: ${error.message}`);
            resolve({
                msg: "Internel Error",
                msg_type: "error"
            })
            // resolve(send_email2(to, subject, text, html))
        });

        cmd.on("close", code => {
            console.log(`child process exited with code ${code}`);
        });
    })
}



router.post("/send_report", async (req, res) => {
    try {
        if (req.session.user_login_info.role.toLowerCase() == "guest") {
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

    let data = req.body.mail;
    for (let key in data)
        if (data[key] == null || (typeof (data[key]) == "object" && Object.keys(data[key]).length == 0) || (typeof (data[key]) == "string" && data[key].trim() == "")) {
            res.send({
                msg: "Incomplete data",
                msg_type: "error"
            })
            return
        }

    data.user = req.session.user_login_info.user
    data.timeline = new Date().getTime()

    let count = await status_report.countDocuments({ uid: data.uid }).then((count, err) => {
        if (err)
            return 0
        console.log("count", count)
        return count
    })
    if (count == 0) {
        const rep = new status_report(data);
        await rep.save(async function (err) {
            if (err) {
                console.log("save", err);
                res.send({
                    msg: "Failed to save",
                    msg_type: "error"
                })
                return
            }
            if (req.body.send) {
                let resp = await send_mail(data.user, data.to, data.subject, null, `${data.template}`)
                if (resp.msg_type == "success") {
                    let updt = await status_report.updateMany({ uid: data.uid }, {
                        status: "sent"
                    });
                    console.log("updt", updt)
                }
                res.send(resp)
            }
            else {
                res.send({
                    msg: "saved",
                    msg_type: "success"
                })
            }

        });
    }
    else {
        let temp_data = data;
        let uid = data.uid
        delete temp_data.uid
        console.log(uid, temp_data.image_link)
        status_report.updateMany({ uid: uid }, temp_data,
            async function (err, result) {
                console.log(err, result)
                if (err) {
                    console.log("update", err);
                    res.send({
                        msg: "Failed to save",
                        msg_type: "error"
                    })
                    return
                }
                if (req.body.send) {
                    let resp = await send_mail(data.user, data.to, data.subject, null, `${data.template}`)
                    if (resp.msg_type == "success") {
                        let updt = await status_report.updateMany({ uid: uid }, {
                            status: "sent"
                        });
                        console.log("updt", updt)
                    }
                    res.send(resp)
                }
                else {
                    res.send({
                        msg: "saved",
                        msg_type: "success"
                    })
                }

            })


    }

})


router.post("/send_reports", async (req, res) => {
    console.log(req.body)

    try {
        if (req.session.user_login_info.role.toLowerCase() == "guest") {
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

    let uids = req.body.uids;
    let default_to = req.body.default_to
    let to = req.body.to
    await status_report.find({ uid: { $in: uids } }).then(async (data, err) => {
        if (err) {
            console.log("update", err);
            res.send({
                msg: "Failed to save",
                msg_type: "error"
            })
            return
        }

        for (let report in data) {
            try {
                let recipients = []
                if (default_to == true)
                    recipients = recipients.concat(data[report].to)
                if (to != "")
                    recipients = recipients.concat(to)
                console.log(recipients)
                for (let i = 0; i < recipients.length; i++) {
                    let resp = await send_mail(req.session.user_login_info.user, recipients[i], data[report].subject, null, `${data[report].template}`)
                    if (resp.msg_type == "success") {
                        let updt = await status_report.updateMany({ uid: data[report].uid }, {
                            status: "sent"
                        });
                        console.log("updt", updt)
                    }
                }

            } catch (error) {
                console.log(error)
            }
        }
    })

    res.send({
        msg: "Sent",
        msg_type: "success"
    })

})


router.all("/get_reports", async (req, res) => {
    try {
        if (req.session.user_login_info.role.toLowerCase() == "guest") {
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

    let where = {}
    if (req.body.timeline_query) {
        where = {
            $and: [
                { timeline: { $gte: req.body.timeline_query.start_date } },
                { timeline: { $lte: req.body.timeline_query.end_date } },
            ]

        }
    }
    if (req.body.where)
        where = Object.assign(where, req.body.where)
    console.log(req.body.timeline_query, "\n", JSON.stringify(where))
    status_report.find(where).then((data, err) => {
        if (err)
            res.send({
                msg: "Failed to get reports",
                msg_type: "error"
            })
        res.send(data)
    });
})


router.post("/del_reports", async (req, res) => {
    console.log(req.body)
    try {
        if (req.session.user_login_info.role.toLowerCase() == "guest") {
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

    let uids = req.body.uids;

    status_report.deleteMany({ uid: { $in: uids } }, function (err) {
        if (err) {
            res.send({
                msg: "Failed to Delete",
                msg_type: "error"
            })
            return
        }
        res.send({
            msg: "Deleted",
            msg_type: "success"
        })
    });

})

router.post("/send_feedback", async (req, res) => {
    console.log(req.body)
    try {
        let html = `
        <b>From: </b>${req.session.user_login_info.user}<br />
        <b>Message: </b><br /><br />
        ${req.body.msg}      
        `
        res.send(await send_mail(req.session.user_login_info.user, "guruprasad.br@terralogic.com", req.body.subject, null, html))
    } catch (error) {
        res.send({
            msg: "Filed to send",
            msg_type: "errr"
        })
    }
})

router.post("/add_log_path", (req, res) => {
    let data = null
    try {
        if (req.session.user_login_info.user == null)
            throw "Not logged in"
        data = {
            log_path: req.body.log_path
        }
    } catch (error) {
        console.log(error, req.session.user_login_info)
        res.send({
            msg: "You are not logged in",
            msg_type: "error"
        })
        return
    }

    const log = new log_tree(data);
    log.save(async function (err) {
        if (err) {
            console.log(err);
            res.send({
                msg: "Failed to Add",
                msg_type: "error"
            })
            return
        }
        res.send({
            msg: "Added",
            msg_type: "success"
        })
    });
})


router.post("/get_log_path", async (req, res) => {
    try {
        if (req.session.user_login_info.user == null)
            throw "Not logged in"

        try {
            if ((await log_tree.find()).length == 0) {
                const log = new log_tree({
                    log_path: "./logs"
                });
                await log.save()
            }
        } catch (error) {
            console.log(error)
        }

        log_tree.find().then(function (data) {
            res.send(data);
        });

    } catch (error) {
        console.log(error, req.session.user_login_info)
        res.send({
            msg: "You are not logged in",
            msg_type: "error"
        })
    }
})

router.post("/set_cur_log_path", (req, res) => {
    try {
        if (req.session.user_login_info.user == null)
            throw "Not logged in"

        req.session.cur_log_path = req.body.log_path
        res.send({
            msg: `Now path is ${req.session.cur_log_path}`,
            msg_type: "success"
        })
    } catch (err) {
        res.send({
            msg: "Error in setting path",
            msg_type: "error"
        })
    }
})

router.post("/get_cur_log_path", (req, res) => {
    try {
        if (req.session.user_login_info.user == null)
            throw "Not logged in"
        if (typeof (req.session.cur_log_path) != "undefined")
            res.send(req.session.cur_log_path + "")
        else
            res.send("0")

    } catch (err) {
        res.send({
            msg: "Error in getting path",
            msg_type: "error"
        })
    }
})
router.post("/remove_log_path", async (req, res) => {

    try {
        if (req.session.user_login_info.user == null)
            throw "Not logged in"
        await log_tree.deleteOne({
            log_path: req.body.log_path
        }, function (err, result) {
            if (err) throw err;
            if (result) {
                res.send({
                    msg: `${req.body.log_path}`,
                    msg_type: "success"
                })
            }
        })
    } catch (err) {
        console.log(err)
        res.send({
            msg: "Error in removing path",
            msg_type: "error"
        })
    }



})

let test_file = '/logs/test/ResultsDetail.xml'

router.all("/test", (req, res) => {
    let cwd = process.cwd()
    res.set({
        'Content-Type': 'text/html',
    });
    res.send(convert.xml2json(fs.readFileSync(cwd + test_file), {
        compact: true,
        spaces: 4
    }))

});

router.all("/path", (req, res) => {

    res.send(process.cwd())
})

router.all("/run_job", (req, res) => {
    if (typeof (req.query.days) != "undefined" && req.query.days != null) {
        readlogs_bg(86400 * req.query.days, req, res)
    } else {
        res.send("Needed [days] as request parameter")
    }
})

router.post("/read_report", async (req, res) => {
    try {
        if (req.session.user_login_info.user == null)
            throw "Not logged in"
        data = {
            log_path: req.body.log_path
        }
    } catch (error) {
        console.log(error, req.session.user_login_info)
        res.send({
            msg: "You are not logged in",
            msg_type: "error"
        })
        return
    }
    try {
        report.findById(ObjectID(req.body.id), async function (err, data) {
            if (err || data == null) {
                res.send("No reports")
                return
            }
            if(!fs.existsSync(data.archive_path+"/"+data.archive_file)){
                res.send("Archive file not found")
                return
            }
            let report = await readReport(data.archive_path+"/"+data.archive_file)
            // console.log(report)
            if (typeof (report === "string")){
                res.setHeader('content-type', 'text/plain');
                res.send(report)
            }
            else{
                res.send("No records")
                return
            }
        })
      
    } catch (error) {
        console.log(error)
        res.send("Unable to open file")
    }
})

router.post("/read_bug_report", async (req, res) => {
    try {
        if (req.session.user_login_info.user == null)
            throw "Not logged in"
        data = {
            log_path: req.body.log_path
        }
    } catch (error) {
        console.log(error, req.session.user_login_info)
        res.send({
            msg: "You are not logged in",
            msg_type: "error"
        })
        return
    }
    try {
        report.findById(ObjectID(req.body.id), function (err, data) {
            if (err || data == null) {
                res.send("No reports")
                return
            }
            if (data.bug_id == null || data.bug_id == ""){
                res.send("No bug reports")
                return
            }
            if(fs.existsSync(data.bug_id)){
                let report = fs.readFileSync(data.bug_id);
                // console.log(report)
                if (typeof (report === "string")){
                    res.setHeader('content-type', 'text/plain');
                    res.send(report)
                    return
                }
            }
           else  if(fs.existsSync(bug_report_path+data.archive_file.split(".").slice(0, -1).join(".") + ".txt")){
                let report = fs.readFileSync((bug_report_path+data.archive_file.split(".").slice(0, -1).join(".") + ".txt"));
                // console.log(report)
                if (typeof (report === "string")){
                    res.setHeader('content-type', 'text/plain');
                    res.send(report)
                    return
                }
           }
            else{
                res.send("No reports")
                return
            }
                
        })

    } catch (error) {
        console.log(error)
        res.send("Unable to open file")
    }
})

function readReport(path) {
    return new Promise((callback) => {
        try {
            const zip = new StreamZip({
                file: path.trim(),
                storeEntries: true
            });

            zip.on('error', async (err) => {
                callback(err)
            });


            zip.on('ready', async () => {
                report_file = "", detail = "", task_log_file = []
                for (const entry of Object.values(zip.entries())) {
                    const desc = entry.isDirectory ? 'directory' : `${entry.size} bytes`;
                    ext = entry.name.split(".").pop()
                    if (ext.match("report"))
                        report_file = entry.name
                }
                try {
                    report_data = zip.entryDataSync(report_file).toString('utf8')
                    callback(report_data)
                } catch (error) {
                    callback(error)
                }

            })

        } catch (error) {
            callback(error)
        }
    })
}

router.post("/suggest", async (req, res) => {
    try {
        dict.find({ word: { $regex: req.body.word, $options: "i" } }).select("word").limit(20).then((data, err) => {
            if (err)
                throw err
            res.send(data)
        });
    } catch (error) {
        console.log(error)
        res.send("Error")
    }
})


router.all("/report_test", async (req, res) => {


    var data_array = (fs.readFileSync('./logs/rep1.report')).toString().split(/\n/)
    let task_ids = []
    for (var i = 0; i < data_array.length; i++) {
        try {
            if (data_array[i].match(/^Test Name\s+Test ID\s+(Arguments\s+)?Results/i)) {
                console.log(data_array[i])
                i += 2;
                while (data_array[i].trim() != "" && !data_array[i].trim().match(/={8,}/) && i < data_array.length) {
                    let task_id = data_array[i].trim().split(/\s{2,}/i)
                    task_ids.push({
                        name: task_id[0],
                        id: task_id[1],
                        result: task_id[task_id.length - 1].toUpperCase(),
                        bug_ids: []
                    })
                    i++
                }
            }
        } catch (error) {

        }
    }
    res.send(task_ids)

})


router.all("/delete_old_reports", async (req, res) => {
    try {
        if (req.session.user_login_info.role.toLowerCase() == "guest") {
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

    if (typeof (req.body.days) != "undefined")
        delete_old_reports(req.body.days).then((resp) => res.send(resp))
    else
        delete_old_reports().then((resp) => res.send(resp))
})


delete_old_reports = async (days = 90) => {
    try {
        let status = await report.deleteMany({ start_time: { $lt: new Date().getTime() - (1000 * 60 * 60 * 24 * days) } })
        console.log(status)
        log_to_file(JSON.stringify(status))
        return status
    } catch (error) {
        console.log(error)
        log_to_file(error)
        return error
    }

}


log_to_file = (txt) => {
    let cwd = process.cwd()
    fs.appendFile(cwd + '/error.txt', new Date() + ": " + txt + "\n", function (err) {
        if (err) {
            console.log(err)
            return
        }
    });
}

log_to_file("------------------------------------------------------")
log_to_file("------------------------------------------------------")




module.exports = router;