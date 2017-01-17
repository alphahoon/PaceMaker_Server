var mongoose = require("mongoose");
var Schema = mongoose.Schema;
 
var userSchema = new Schema({
		    	name: String,
		    	photo: String,
		    	goals_title: [String],
		    	goals_id: [String],
		    	token: String
				    
					});
 
module.exports = mongoose.model('user',userSchema);