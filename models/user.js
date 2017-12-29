var mongoose = require('mongoose');

var userSchema = new mongoose.Schema({
    id: String,
	access_token: String,
	google_ac_token:String,
	firstName: String,
	lastName: String,
	email: String,
	feedback: Number,
	num_recensioni: Number,
	somma_valutazione: Number,
	eventi: [{
		type: mongoose.Schema.Types.ObjectId,
       	ref: "Evento"
	}],
});

module.exports = mongoose.model("User", userSchema);
