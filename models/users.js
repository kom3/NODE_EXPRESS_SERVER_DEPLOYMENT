var mongoose = require('mongoose');


const usersSchema = mongoose.Schema({
  username: {
    type: String,
    unique:true,
    required: true
  },
  role: {
    type: String,
    required: true
  },
  profileImage:{
    type: String,
    required: true
   
  }
});


var Users = mongoose.model('users', usersSchema);
module.exports = Users;
