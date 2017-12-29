var mongoose = require('mongoose');

var eventoSchema = new mongoose.Schema({
    _id: String,
    data: Date,
    ora: Number,
    campetto:String,
    geo: {
    	type: {type: String, default:'Point'},
    	coordinates: [Number]
    },
    partecipanti_att: Number,
	squadra_A: [{
		type: mongoose.Schema.Types.ObjectId,
       	ref: "User"
	}],
	squadra_B: [{
		type: mongoose.Schema.Types.ObjectId,
       	ref: "User"
	}],
	creatore: {
		type: mongoose.Schema.Types.ObjectId,
       	ref: "User"
	}
});

eventoSchema.index({geo: '2dsphere'});

module.exports = mongoose.model("Evento", eventoSchema);
