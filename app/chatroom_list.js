var mongoose = require("mongoose");
var Schema = mongoose.Schema;
 
var chatroomSchema = new Schema({
				pid: String,
		    	title: String,
		    	color: String,
		    	participant_token: [String],
		    	people: Number
				    
					});
 
module.exports = mongoose.model('chatroom',chatroomSchema);