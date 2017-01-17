var mongoose = require("mongoose");
var Schema = mongoose.Schema;
 
var goalCloneSchema = new Schema({
				pid: String,
		    	title: String,
		    	todo: [String],
		    	owner_token: String,
		    	mon: [String],
		    	tue: [String],
		    	wed: [String],
		    	thu: [String],
		    	fri: [String],
		    	sat: [String],
		    	sun: [String],
		    	dateFrom: String,
		    	dateTo: String,
		    	latitude: String,
		    	longitude: String,
		    	public: Boolean,
		    	memo: [String],
		    	photo: String, 
				    
					});
 
module.exports = mongoose.model('goal_clone',goalCloneSchema);