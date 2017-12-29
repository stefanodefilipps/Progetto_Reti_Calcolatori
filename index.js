var express     		= require("express"),
    app         		= express(),
    methodOverride 		= require("method-override"),
    bodyParser  		= require("body-parser"),
    mongoose    		= require("mongoose"),
    Evento  			= require("./models/evento"),
    User				= require("./models/user"),
    passport    		= require("passport"),
    amqp 				= require('amqplib/callback_api'),
    fbConfig 			= require('./fb.js'),
    request      		= require('request'),
    FormData 			= require('form-data'),
	  FacebookStrategy 	= require('passport-facebook').Strategy,
	  GoogleStrategy 		= require('passport-google-oauth20').Strategy,
    amqp              = require('amqplib/callback_api'),
    WebSocket = require('ws'),
    CircularJSON = require('circular-json'),
    http = require('http');
  

/**
============================================
SETTAGGIO DEI MODULI CHE VERRANNO UTILIZZATI
============================================
**/

mongoose.connect("mongodb://localhost/sport");
app.use(bodyParser.urlencoded({extended: true}));
app.use(methodOverride("_method"));
app.set("view engine", "ejs");

app.use(require("express-session")({
    secret: "sport giorgio gianmarco stefano",
    resave: false,
    saveUninitialized: false
}));


app.use(passport.initialize());
app.use(passport.session());
passport.use('facebook', new FacebookStrategy({
  clientID        : fbConfig.appID,
  clientSecret    : fbConfig.appSecret,
  callbackURL     : fbConfig.callbackUrl,
  profileFields   : fbConfig.profileFields
},
  // facebook will send back the tokens and profile
  function(access_token, refresh_token, profile, done) {
    // asynchronous
    process.nextTick(function() {
    	console.log(profile);
    	console.log(profile.id);

      // find the user in the database based on their facebook id
      User.findOne({ 'id' : profile.id }, function(err, user) {

        // if there is an error, stop everything and return that
        // ie an error connecting to the database
        if (err)
          return done(err);

          // if the user is found, then log them in
          if (user) {
            user.online = true;
            return done(null, user); // user found, return that user
          } else {
            // if there is no user found with that facebook id, create them
            console.log("NOTFOUND");
            var newUser = new User();

            // set all of the facebook information in our user model
            newUser.id    = profile.id; // set the users facebook id
            newUser.access_token = access_token; // we will save the token that facebook provides to the user
            newUser.firstName  = profile.name.givenName;
            newUser.lastName = profile.name.familyName; // look at the passport user profile to see how names are returned
            newUser.email = profile.emails[0].value; // facebook can return multiple emails so we'll take the first
            newUser.feedback=0;
            newUser.num_recensioni=0;
            newUser.somma_valutazione=0;
            newUser.eventi=[];
            newUser.google_ac_token="";
            newUser.online=true;

            // save our user to the database
            newUser.save(function(err) {
              if (err)
                throw err;

              // if successful, return the new user
              return done(null, newUser);
            });
         }
      });
    });
}));

passport.use(new GoogleStrategy({
    clientID: "659266014657-tino93761qr2a4vbhpblgf0o789gohdl.apps.googleusercontent.com",
    clientSecret: "9BRIVPUQMALCXYkO2it7qUJD",
    callbackURL: "http://localhost:3000/connect/google/callback",
    scope : ['https://www.googleapis.com/auth/calendar',"profile"],
    passReqToCallback: true
  },
  function(req,accessToken, refreshToken, profile, cb) {
  	req.user.google_ac_token = accessToken;
  	User.findByIdAndUpdate(req.user._id,{$set:{google_ac_token:accessToken}},function(err,mod){
  		if(err) console.log(err);
  		else{
  			console.log(mod);
  			return cb(null,profile);
  		} 

  	})
  }
));


passport.serializeUser(function(user, done) {
    console.log('serializing user: ');
    console.log(user);
    done(null, user._id);
});

passport.deserializeUser(function(id, done) {
    User.findById(id, function(err, user) {
        console.log('deserializing user:',user);
        done(err, user);
	});
});


  

/**
==================================================================
QUI VANNO MESSE TUTTE I ROUTE DELLE API DEL SERVIZIO DA SVILUPPARE
==================================================================
**/

app.get("/",function(req,res){
	res.render("home");
})


//ROUTE PER GESTIRE GLI EVENTI DEL CALENDARIO DOPO AVER OTTENUTO AUTORIZZAZIONE DI GOOGLE
app.post("/addc",isLoggedIn,function(req,res){
	Evento.findById(req.body.evento,function(err,foundE){
		if(err){
			console.log(err);
			res.redirect("/");
		}
		else{
			var nome_e=foundE._id;
			var data_e=foundE.data;
			data_e.setHours(foundE.ora);
			var lat_e = foundE.geo.coordinates[1];
			var lng_e = foundE.geo.coordinates[0];
			request('https://maps.googleapis.com/maps/api/geocode/json?latlng='+lat_e+','+lng_e+'&key=AIzaSyAIyWmKzf9p5lVUeeNJ4wKyqbNTF9pX86E',
		    function (error, response, body){
		    	if (!error && response.statusCode == 200) {
		    		var luogo = JSON.parse(body).results[0].formatted_address;
	    		var calendar_event = {
	    				location:luogo,
	    				summary: "partecipa all'evento: "+nome_e,
						end:
						{
						dateTime:data_e.toISOString()
						},
						start:
						{
						dateTime:data_e.toISOString()
						}
					};

		    		var request_option={
		    			url: "https://www.googleapis.com/calendar/v3/calendars/primary/events",
		    			headers: {
					    'Authorization': 'Bearer '+req.user.google_ac_token,
					    'Content-Type': 'application/json' 
					    },
					    body: calendar_event,
					    json:true
		    		}
		    		request.post(request_option,function(error, response, body){
		    			if (!error && response.statusCode == 200) {
		    				console.log("evento creato");
		    				console.log(body);
		    				console.log(error);
		    				res.redirect("/");
		    			}
		    			else{
		    				console.log(error);
		    				console.log(response.statusCode)
		    				console.log(body);
		    				res.redirect("/");
		    			}
		    		})
		    	}
		    })
		}
	})
})

//ROUTE PER LA CREAZIONE DI UN EVENTO
app.post("/CreaEvento",isLoggedIn,function(req, res){
	var nomeevento = req.body.nomeevento; 
  var campetto_ = req.body.campetto;
	var ora = Number(req.body.ora);
	var data_ = new Date(Number(req.body.anno),Number(req.body.mese)-1,Number(req.body.giorno));
	console.log(data_);
  console.log(req.body);
  console.log(req.body.lat+" "+req.body.lng);
	var lat = Number(req.body.lat);
  var lng = Number(req.body.lng);
  console.log(lat+" "+lng);
  var object = {
        _id: nomeevento, 
        data: data_,
        ora: ora,
        geo: {
          coordinates: [lng,lat]
        } ,
        partecipanti_att: 1,
        squadra_A: [req.user],
        squadra_B: [],
        creatore: req.user,
        campetto:campetto_
      }

      Evento.create(object, function(err,foundE){
        if(err){
          console.log(err);
          res.redirect("/");
        }
        else{
          console.log("Evento creato con successo");
          res.redirect("/");
        }

        User.findById(req.user._id).populate("eventi").exec(function(err,foundU){
            if(err){
               console.log(err);
                 res.redirect("/");
                 return;
            }
            foundU.eventi.push(foundE);
            amqp.connect('amqp://172.17.0.2:5672', function(err, conn) {
            conn.createChannel(function(err, ch) {
            if(err){
            console.log("errore nella creazione canale");
            }
            ch.assertExchange(foundE._id, 'fanout', {durable: false});
            ch.assertQueue(req.user.email, {exclusive: false}, function(err, q) {
              console.log(" creazione coda %s.", q.queue);
              ch.bindQueue(q.queue, foundE._id, req.user.email);
              ch.publish(foundE._id, '', new Buffer(req.user.email+" si è aggiunto alla squadra A dell'evento "+foundE._id));
              console.log("messaggio inviato");
            });
      
          });
          setTimeout(function() { conn.close();  }, 500);
        });
        
            foundU.save(function(err){
                if(err){
                console.log(err);
                res.redirect("/");
                } 

          })

        })

      })
})

//elimina evento
app.post("/cancellaEvento",isLoggedIn,function(req,res){
  Evento.findById(req.body.eventoc).populate("creatore").populate("squadra_A").populate("squadra_B").exec(function(err,foundE){
    if(err){
       res.status(500).send(err)
    }
     if (foundE) {
            console.log(foundE);
            if(foundE.creatore.equals(req.user._id)){
              User.findById(req.user._id).populate("eventi").exec(function(err,foundU){
                  foundU.eventi.pop(foundE);
                  foundU.save(function(err){
                  if(err){
                  console.log(err);
                  res.redirect("/");
                 }
                 });
              });
              foundE.squadra_A.forEach(function(e){
                User.findById(e._id).populate("eventi").exec(function(err,foundU){
                  foundU.eventi.pop(foundE);
                    foundU.save(function(err){
                    if(err){
                    console.log(err);
                    res.redirect("/");
                    }
                    });
                });
              });
                
              foundE.squadra_B.forEach(function(e){
               User.findById(e._id).populate("eventi").exec(function(err,foundU){
                  foundU.eventi.pop(foundE);
                    foundU.save(function(err){
                    if(err){
                    console.log(err);
                    res.redirect("/");
                    }
                    });
                });
              });
              amqp.connect('amqp://172.17.0.2:5672', function(err, conn) {
              conn.createChannel(function(err, ch) {
              if(err){
                  console.log("errore nella creazione canale");
              }
                  ch.assertExchange(foundE._id, 'fanout', {durable: false});
                  ch.publish(foundE._id, '', new Buffer("***ATTENZIONE*** L'evento "+foundE._id+" è stato cancellato"));
                  ch.deleteExchange(foundE._id);
              });
                  setTimeout(function() { conn.close();  }, 500);
              });
              Evento.findByIdAndRemove(foundE._id, function(err, evento){  
              if(err) res.status(404).send("non hai i permessi");
              });
              
            }
            else res.status(404).send("non hai i permessi");
            
        } else {
        res.status(404).send("No event found with that ID");
    };
  });
});




//ROUTE PER LA SELEZIONE DI UN LUOGO, DATO UN INDIRIZZO DI RIFERIMENTO
app.get("/selezionaluogo",isLoggedIn,function(req,res){
  request('https://maps.googleapis.com/maps/api/geocode/json?address='+req.query.indirizzo+'+'+req.query.citta+'&key=AIzaSyAIyWmKzf9p5lVUeeNJ4wKyqbNTF9pX86E',
    function (error, response, body){
    if (!error && response.statusCode == 200) {
    var info = JSON.parse(body);
    console.log(info.results[0].geometry.location.lat);
    console.log(info.results[0].geometry.location.lng);
    request('https://maps.googleapis.com/maps/api/place/nearbysearch/json?keyword=calcetto&location='+info.results[0].geometry.location.lat+','+info.results[0].geometry.location.lng+
      '&radius=3000&key=AIzaSyC-iczdxkw-J2IaVzZLtrCzY6OBX9gP9Pw', function(error, response, body){
        if (!error && response.statusCode == 200){
        	res.send(body);
        	console.log(JSON.parse(body));
          JSON.parse(body).results.forEach(function(e){
            console.log(e.geometry.location.lat+" "+e.geometry.location.lng);
          })
        } 
      });
  }
});
});


//ROUTE PER IL RILASCIO DI UN FEEDBACK
app.put("/feedback", isLoggedIn, function(req, res){

	var evento = req.body.eventoterminato;
	var emailrecensito = req.body.emailrecensito;
	var feed = Number(req.body.valore);


    Evento.findById(req.body.eventoterminato).populate("squadra_A").populate("squadra_B").exec(function(err, foundE){
      if(err){
      console.log(err);
      res.redirect("/");
      return;
    }


    if(foundE._id == evento){
    	var i;
    	var trovato = false;
    	for(i=0; i<foundE.squadra_A.length; i++){
    		if(emailrecensito == foundE.squadra_A[i].email){
    			console.log("Utente trovato, puoi inviare il feedback");
    			trovato = true;
    		}
    		
    	}

    	if(!trovato){
    			for(i=0; i<foundE.squadra_B.length; i++){
    				if(emailrecensito == foundE.squadra_B[i].email){
    				console.log("Utente trovato, puoi inviare il feedback");
    				trovato = true;
    				}
    			}	

    	}

    	if(!trovato){
    		console.log("Utente da recensire non è presente in questo evento");
    		res.redirect("/");
    		return;
    	}

    	User.findById(req.user._id).populate("eventi").exec(function(err,foundU){
    		var trovatoRichiedente = false;
    		for(i=0; i<foundU.eventi.length;i++){
    			if(req.body.eventoterminato == foundU.eventi[i]._id){
    				trovatoRichiedente = true;
    			}
    		}
    		if(!trovatoRichiedente){
			console.log("Utente che richiede non ha partecipato all'evento");
    		res.redirect("/");
    		return;
    	}

    	})

    	


    	User.findOne({"email":emailrecensito}, function(err,found){
    		var oldfeedback = found.feedback;
    		var somma = found.somma_valutazione;
    		var rec = found.num_recensioni +1 ;
    		var media = (somma + feed) / rec;

    		var object = { 
    			$set:
      				{
        				feedback: media,
        				somma_valutazione: somma+feed,
        				num_recensioni: rec
      				}
   				}

    		User.findByIdAndUpdate(found._id, object, function(err, modificati){
    			if(err){
    				console.log(err);
    				res.redirect("/");
    			}
    			else{
    				console.log(modificati);
    				res.redirect("/");
    			}
    		}) 
    		
    	});


    }

    })

})



//ROUTE PER LA RICERCA DI UN EVENTO UNA VOLTA SPECIFICATO DATA E LUOGO
app.get("/search",isLoggedIn,function(req,res){
	var giorno = Number(req.query.giorno);
	var mese = Number(req.query.mese);
	var anno = Number(req.query.anno);
	var indirizzo = req.query.indirizzo;
	var data_ = new Date(anno,mese-1,giorno);

  request('https://maps.googleapis.com/maps/api/geocode/json?address='+req.query.indirizzo+'+'+req.query.citta+'&key=AIzaSyAIyWmKzf9p5lVUeeNJ4wKyqbNTF9pX86E',
    function (error, response, body){
    if (!error && response.statusCode == 200) {

          var info = JSON.parse(body);
          console.log(info.results[0].geometry.location);
          Evento.find({
            'data': data_,
            'geo':{
              $near:  {
                   $geometry: {
                      type: "Point" ,
                      coordinates: [info.results[0].geometry.location.lng,info.results[0].geometry.location.lat]
                   },
              $maxDistance: 3500
              }
            }
          }).exec(function(err,events){
            if(err){
              console.log(err);
              res.redirect("/");
            }
            else{
              console.log(events);
              res.send(JSON.stringify(events));
            }
          })
      }

    })

})




//ROUTE PER L'AGGIUNTA DELL'UTENTE AD UN EVENTO SPECIFICATOz
app.get("/dammievento",isLoggedIn,function(req,res){
  Evento.findById(req.query.ev).populate("squadra_A").populate("squadra_B").exec(function(err,foundE){

      res.send(JSON.stringify(foundE));
  });
});

app.get("/chisono",isLoggedIn,function(req,res){
  amqp.connect('amqp://172.17.0.2:5672', function(err, conn) {
          conn.createChannel(function(err, ch) {
            if(err){
            console.log("errore nella creazione canale");
            }
            console.log(req.user.email);
            
            ch.assertQueue(req.user.email, {exclusive: false}, function(err, q) {
              console.log(" creazione coda %s.", q.queue);
            });
      
          });
          setTimeout(function() { conn.close();  }, 500);
        });
  res.send(req.user.email);
   

})


app.put("/MiAggiungo", isLoggedIn, function(req, res){
  Evento.findById(req.body.evento).populate("squadra_"+req.body.Squadra).exec(function(err, foundE){
      if(err){
      console.log(err);
      res.redirect("/");
      return;
    }
    console.log("Stai richiedendo di aggiungerti");

    var squadra = req.body.Squadra;
    if(squadra=="A"){
      var A = foundE.squadra_A;
      if(A!=null && A.length <5){
        foundE.squadra_A.push(req.user);
        foundE.save();
        res.send("Aggiunto");
        amqp.connect('amqp://172.17.0.2:5672', function(err, conn) {
          conn.createChannel(function(err, ch) {
            if(err){
            console.log("errore nella creazione canale");
            }
            ch.assertExchange(foundE._id, 'fanout', {durable: false});
            ch.assertQueue(req.user.email, {exclusive: false}, function(err, q) {
              console.log(" creazione coda %s.", q.queue);
              ch.bindQueue(q.queue, foundE._id, req.user.email);
              ch.publish(foundE._id, '', new Buffer(req.user.email+" si è aggiunto alla squadra A dell'evento "+foundE._id));
              console.log("messaggio inviato");
            });
      
          });
          setTimeout(function() { conn.close();  }, 500);
        });
        

        Evento.findByIdAndUpdate(foundE._id, {$set:{partecipanti_att: foundE.partecipanti_att+1}}, function(err, modificati){
            	if(err){
            		console.log(err);
            	}
            	else{
            		console.log(modificati);
            	}
            })
      }
      else{
      res.send("Non Aggiunto");
      return;
      }
        
  }
        else{
          var B = foundE.squadra_B;
            if(B!=null && B.length <5){
            foundE.squadra_B.push(req.user);
            foundE.save(function(err){
            	if(err) console.log(err);
            });
            res.send("Aggiunto");
            amqp.connect('amqp://172.17.0.2:5672', function(err, conn) {
          conn.createChannel(function(err, ch) {
            if(err){
            console.log("errore nella creazione canale");
            }
            ch.assertExchange(foundE._id, 'fanout', {durable: false});
            ch.assertQueue(req.user.email, {exclusive: false}, function(err, q) {
              console.log(" creazione coda %s.", q.queue);
              ch.bindQueue(q.queue, foundE._id, req.user.email);
              ch.publish(foundE._id, '', new Buffer(req.user.email+" si è aggiunto alla squadra B dell'evento "+foundE._id));
              console.log("messaggio inviato");
            });
      
          });
          setTimeout(function() { conn.close();  }, 500);
        });
            var par = foundE.partecipanti_att;
            Evento.findByIdAndUpdate(foundE._id, {$set:{partecipanti_att: par+1}}, function(err, modificati){
            	if(err){
            		console.log(err);
            	}
            	else{
            		console.log(modificati);
            	}
            })
            }
              else{
               res.send("Non Aggiunto");
               return;
              }

        }
        User.findById(req.user._id).populate("eventi").exec(function(err,foundU){
    		if(err){
     			 console.log(err);
      			 res.redirect("/");
      			 return;
    		}
    	foundU.eventi.push(foundE);
    	foundU.save(function(err){
      		if(err){
        	console.log(err);
        	res.redirect("/");
      }

	})
})
})
})



//ROUTE PER MOSTRARE TUTTI GLI EVENTI ASSOCIATI A UN UTENTE (RESTITUISCO SOLO I NOMI DEGLI EVENTI)
app.get("/eventi",isLoggedIn,function(req,res){
  User.findById(req.user._id).populate("eventi","_id").exec(function(err,foundU){
    var risposta = {ev:[]};
    var finito;
    foundU.eventi.forEach(function(e){
      finito = false;
      console.log(e);
        risposta.ev.push(e);
    })
    res.send(JSON.stringify(risposta));
  })
});



//ROUTE PER DISSOCIARE UN UTENTE DA UN EVENTO A CUI PARTECIPA
app.put("/abbandona",isLoggedIn,function(req,res){
  User.findById(req.user._id).populate("eventi").exec(function(err,foundU){
    if(err){
      console.log(err);
      res.redirect("/");
      return;
    }
    console.log("stai abbandonando");
    var contenuto = foundU.eventi.find(function(id_ev){
      return id_ev._id == req.body.evento;
    });
    if(contenuto == undefined){
      console.log("utente non contiene questo elemento");
      res.send("Non hai questo elem");
      return;
    }
    console.log(contenuto);
        Evento.findById(req.body.evento).populate("squadra_"+req.body.squadra).exec(function(err,foundE){
          if(err){
            console.log(err);
            res.redirect("/");
            return;
          }
          amqp.connect('amqp://172.17.0.2:5672', function(err, conn) {
          conn.createChannel(function(err, ch) {
            if(err){
            console.log("errore nella creazione canale");
            }
            ch.assertExchange(foundE._id, 'fanout', {durable: false});
            
              
              ch.publish(foundE._id, '', new Buffer(req.user.email+" ha abbandonato l'evento  "+foundE._id));
              ch.unbindQueue(req.user.email, foundE._id, req.user.email);
      
          });
          setTimeout(function() { conn.close();  }, 500);
        });
            console.log(req.user._id);
            var contenuto;
            if(req.body.squadra == "A"){
              foundE.squadra_A.forEach(function(us){
                console.log(us._id);
                if(us._id.equals(req.user._id)){
                  contenuto = us;
                }
              })
            }
            else{
              foundE.squadra_B.forEach(function(us){
                console.log(us._id);
                if(us._id.equals(req.user._id)){
                  contenuto = us;
                }
              })
            }
            if(contenuto == undefined){
              console.log("Evento non contiene questo utente");
              res.send("Non sei in questa squadra");
              return;
            }
            if(req.body.squadra == "A"){
            	foundE.squadra_A.pop(contenuto);
	            foundE.save(function(err){
	              if(err){
	                console.log(err);
	                res.redirect("/");
	              }
	              else{
	                res.redirect("/");
	              }
	            })
      		}
      		else{
      			foundE.squadra_A.pop(contenuto);
	            foundE.save(function(err){
	              if(err){
	                console.log(err);
	                res.redirect("/");
	              }
	              else{
	                res.redirect("/");
	              }
	            })
      		}
      		foundU.eventi.pop(contenuto);
    		foundU.save(function(err){
    			if(err) console.log(err);
    			foundE.partecipanti_att=foundE.partecipanti_att-1;
    			foundE.save(function(err){
    				if(err) console.log(err);
    			})
    		})
        })
  })
})


/**
===========================================================
QUI SI GESTISCE LA PARTE DI LOGIN E LOGOUT TRAMITE FACEBOOK
===========================================================
**/

//AUTENTICAZIONE FACEBOOK ROUTE

app.get("/login",function(req,res){
	res.render("login");
})

app.get('/login/facebook',
  passport.authenticate('facebook', {scope : ['email'] }
));

app.get('/login/facebook/callback',
  passport.authenticate('facebook', {
    successRedirect : '/',
    failureRedirect : '/login/facebook'
  })
);


// LOG OUT DA APPLICAZIONE E QUINDI NIN DA FACEBOOK E NON DEVO RIMETTERE CREDENZIALI DI FACEBOOK
app.get("/logout", function(req, res){
   req.logout();
   res.redirect("/login");
});

// LOG OUT DA FACEBOOK E QUINDI PERMETTE DI IMMETTERE CREDENZIALI NUOVO UTENTE
app.get('/logoutFromFacebook', function(req, res) {
    res.redirect('https://www.facebook.com/logout.php?next=http://localhost:3000/logout&access_token='+req.user.access_token);
});

//FUNZIONE MIDDLEWARE CHE PERMETTE DI ESEGUIRE DETERMINATE ROUTE SE E SOLO SE L'UTENTE SI È IDENTIFICATO
function isLoggedIn(req, res, next){
    if(req.isAuthenticated()){
        return next();
    }
    res.redirect("/login");
}

//CONFIGURAZIONE AUTORIZZAZIONE GOOGLE

app.get('/connect/google',
  passport.authorize('google', { failureRedirect: '/login' })
);

app.get('/connect/google/callback',
  passport.authorize('google', { failureRedirect: '/login' }),
  function(req, res) {
    var user = req.user;
    var account = req.account;
    res.redirect("/");
  }
);



/**
================
AVVIO DEL SERVER
================
**/

var server = http.createServer(app);

/**
Il sistema di chat lo implemento tenendo un array in cui mantengo degli oggetti che contengono l'email di chi ha aperto la
web socket e la web socket aperta per scrivere a un secondo utente. connections è l'array che mantiene questi oggetti.
Quando un utente apre una web socket con il server nella uri specifica anche la sua email che preleva sempre dal server
e in questo modo sono in grado di identificare le connessioni con le persone.
per implementare il sistema di messaggistica si utilizza un semplice protocollo in cui i messaggi scambiati sono degli oggetti JSON
così fatti:
msg = {
  src:String,
  dest:String
  msg:String
}
Dove src e dest sono le email dell'utente che invia il messaggio e di quello che lo riceve. Il server prende dest e vede se è presente 
in connections. In caso positivo inoltra direttamente il messaggio sulla web socket trovata di dest, altrimenti notifica src che l'utente
da lui richiesto non è online o non esiste.
Suppongo che si possa comunicare con una persona alla volta e quindi quando un utente è già attivo in una chat, se riceve un messaggio da 
una persona differente da quella attuale, in automatico alla nuova sorgente manda un messaggio in uci lo avvisa che è impegnato in una
comunicazione e che dovrà riprovare in seguito il contatto.
Infine esiste un messaggio speciale "LEFT_@#" che serve per segnalare l'uscita di un utente da una chat e renderlo così disponibile ad 
altri utenti
**/

var connections = [];

var wss = new WebSocket.Server({server});
wss.on('connection', function connection(ws,req) {
  var prova = ws;
  //in questo modo riesco a estrapolare il parametro nella url
  console.log(req.url.slice(req.url.search("=")+1));
  var e = req.url.slice(req.url.search("=")+1);               // con queste righe mi sto tirando fuori l'email dall'uri della richiesta della web socket
  var o = {
    email:e,
    web_s:ws
  }
  connections.push(o);

  ws.on('message', function incoming(message) {
    var obj = JSON.parse(message);
    //se ho fatto refresh della pagina devo eliminare la ws precedente che non è open altrimenti mi da problemi perchè
    //la prima che trova find al passo successivo è quella non open e non posso mandare messaggi
    var trovato = connections.find(function(em){
      return em.email == obj.dest && !(em.web_s.readyState === WebSocket.OPEN);
    })
    if(trovato != undefined){
      connections.splice(connections.indexOf(trovato),1);
    }
    trovato = connections.find(function(em){
      return em.email == obj.dest && em.web_s.readyState === WebSocket.OPEN;
    })
    if(trovato == undefined){
      var nf={
        src:"server",
        dest:"",
        message:"Utente non online"
      }
      ws.send(JSON.stringify(nf));
    } 
    else{
      trovato.web_s.send(message,function(err){
        if(err) console.log(err);
      });
    }
  });
});






server.listen(3000, function listening() {
  console.log('Listening on %d', server.address().port);
});