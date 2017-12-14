var mongoose = require('mongoose');
var Evento  = require("./models/evento");
var User	= require("./models/user");

mongoose.connect("mongodb://localhost/sport");

var loc = {
	coordinates: [41.46588472,12.90381789]
}


var obj_e = {
	_id:"prova",
	data: new Date(2017,12,11),
    ora: 19,
    geo : loc,
    partecipanti_att: 2,
	squadra_A: [],
	squadra_B: []
}

Evento.create(obj_e,function(err,nuovo){
	if(err) console.log(err);
	else{
		console.log(nuovo);
		 User.findById("5a2e94aa072b093d24214c00").populate("eventi").exec(function(err,foundU){
		 	if(err) console.log(err);
		 	else{
		 		foundU.eventi.push(nuovo);
		 		foundU.save(function(err){
		 			if(err) console.log(err);
		 		});
		 		nuovo.squadra_A.push(foundU);
		 		nuovo.save(function(err){
		 			if(err) console.log(err);
		 		})
		 	}
		 });
	}
})
