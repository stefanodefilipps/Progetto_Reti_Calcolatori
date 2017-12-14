var mongoose = require('mongoose');
var Evento  = require("./models/evento");

mongoose.connect("mongodb://localhost/sport");

var loc = {
	coordinates: [41.46588472,12.90381789],
}


var obj_e = {
	id:"evento prova",
	data: new Date(),
    ora: 19,
    geo : loc,
    partecipanti_att: 2,
	squadra_A: [],
	squadra_B: []
}
/**
Evento.create(obj_e,function(err,nuovo){
	if(err) console.log(err);
	else console.log(nuovo);
})
var q = Evento.find({'geo':{
  $near:  {
       $geometry: {
          type: "Point" ,
          coordinates: [40.46588472,12.90381789]
       },
  $maxDistance: 110000

  }
}});
q.exec(function(err,event){
	if(err) console.log(err);
	else console.log(event);
})
**/
var data = new Date(2017,12,11);

Evento.find({"data":data.toISOString()},function(err,founds){
  if(err) console.log(err);
  else console.log(founds);
})