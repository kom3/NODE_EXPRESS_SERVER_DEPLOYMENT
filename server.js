const express = require("express");
const connectDB = require("./config/db")
const cors = require('cors')
const app = express();
const session = require('express-session')
var compression = require('compression')

//connect DB
connectDB()

var MongoDBStore = require('connect-mongodb-session')(session);
var store = new MongoDBStore({
  uri: 'mongodb://localhost:27017/test_project_session_unindexed',
  collection: 'mySessions'
});

// Catch errors
store.on('error', function (error) {
  console.log(error);
});

app.use(require('express-session')({
  secret: 'This is a secret',
  cookie: {
    maxAge: 1000 * 60 * 60 * 24 * 7 // 1 week
  },
  store: store,
  resave: true,
  saveUninitialized: true,
  cookie: {
    path: '/'
  },
}));





//init middleware
//as body parser includedin expreess we dont need bodyParser.json()
app.use(compression())
app.use(express.json({
  limit: '50mb',
  extended: false
}))

app.use(cors())
const port = process.env.PORT || 8888;


app.use('/', express.static('./client/build'))

// app.get('/',(req,res)=>{
//     res.send("API Running");
// })

//Define Routes
app.use('/api/users', require("./routes/api/users"));
app.use('/api/users', require("./routes/api/usersstore"));
app.use('/api', require("./routes/api/default_api.js"));


  try {
    app.listen(port, () => {
      console.log(`App started running at ${port}`)
    })
  } catch (error) {
    console.log(error)
  }
