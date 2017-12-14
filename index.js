var express     		= require("express"),
    app         		= express(),
    methodOverride 		= require("method-override"),
    bodyParser  		= require("body-parser"),
    mongoose    		= require("mongoose"),
    Evento  			= require("./models/evento"),
    User				= require("./models/user"),
    passport    		= require("passport"),
    amqp 				= require('amqplib/callback_api'),
    fbConfig 			= require('./fb.js');
	FacebookStrategy 	= require('passport-facebook').Strategy;
	GoogleStrategy 		= require('passport-google-oauth20').Strategy;
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
          	console.log("GIORGIO STRONZO");
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
    callbackURL: "http://localhost:3000/addc",
    scope : ['https://www.googleapis.com/auth/calendar','profile']
  },
  function(accessToken, refreshToken, profile, cb) {
    console.log(cb);
    console.log(profile);
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


app.get("/addc",function(req,res){
	res.send("GIORGIO CAZZO");
})

//ROUTE PER LA RICERCA DI UN EVENTO UNA VOLTA SPECIFICATO DATA E LUOGO

app.get("/search",isLoggedIn,function(req,res){
	var giorno = Number(req.query.giorno);
	var mese = Number(req.query.mese);
	var anno = Number(req.query.anno);
	var data_ = new Date(anno,mese,giorno);
	var lat = req.query.lat;
	var long = req.query.long;
	Evento.find({
		"data":data_,
		'geo':{
		  $near:  {
		       $geometry: {
		          type: "Point" ,
		          coordinates: [Number(lat),Number(long)]
		       },
		  $maxDistance: 30
			}
		}
	}).exec(function(err,events){
		if(err){
			console.log(err);
			res.redirect("/");
		}
		else{
			res.send(JSON.stringify(events));
		}
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
    foundU.eventi.pop(contenuto);
    foundU.save(function(err){
      if(err){
        console.log(err);
        res.redirect("/");
      }
      else{
        Evento.findById(req.body.evento).populate("squadra_"+req.body.squadra).exec(function(err,foundE){
          if(err){
            console.log(err);
            res.redirect("/");
            return;
          }
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
        })
      }
    });
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

//CONF GOOGLE

app.get('/auth/google',
  passport.authenticate('google', { scope: ['profile',"https://www.googleapis.com/auth/calendar"] }));

app.get('/auth/google/callback', 
  passport.authenticate('google', { failureRedirect: '/' }),
  function(req, res) {
    // Successful authentication, redirect home.
    res.redirect('/addc');
  });

/**
================
AVVIO DEL SERVER
================
**/
var server = app.listen(3000, function () {
  var host = server.address().address;
  var port = server.address().port;

  console.log('Example app listening at http://%s:%s', host, port);
});