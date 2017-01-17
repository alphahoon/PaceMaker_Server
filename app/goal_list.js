var mongoose = require("mongoose");
var Schema = mongoose.Schema;
 
var goalSchema = new Schema({
		    	title: String,
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
		    	numPeople: Number,
		    	participant_token: [String],
		    	latitude: Number,
		    	longitude: Number,
		    	public: Boolean,
		    	description: String,
		    	photo: String, 
				    
					});
 
module.exports = mongoose.model('goal',goalSchema);