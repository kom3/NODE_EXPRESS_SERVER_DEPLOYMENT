const mongoose = require("mongoose");
const config = require("config");
const db = config.get("mongoURI")

//connecting db using async await

const connectDB = async ()=>{
    try{
        await mongoose.connect(db,{
            useUnifiedTopology:true ,
            useNewUrlParser: true,
            useFindAndModify:false
        })
        console.log("MongoDB connected");
    }catch(err){
        console.error(err);
        process.exit(1);
    }
}

module.exports =connectDB;