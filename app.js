if(process.env.NODE_ENV != 'production'){
    require('dotenv').config();
    // require('dotenv').config({ override: true });
}

const express = require('express');
const app = express();
const mongoose = require("mongoose");
const path = require('path');
const methodOverride = require('method-override');
const ejsMate = require('ejs-mate');
const ExpressError = require('./utils/ExpressError.js');
const session = require('express-session');
const MongoStore = require('connect-mongo');
const flash = require('connect-flash');
const passport = require('passport');
const LocalStrategy = require('passport-local');
const User = require('./models/user.js');

const listingsRouter = require('./routes/listing.js');
const reviewRouter = require('./routes/review.js');
const userRouter = require('./routes/user.js');

// const MONGO_URL ='mongodb://127.0.0.1:27017/wanderlust';

const dbUrl = process.env.ATLASDB_URL;


main()
    .then(() => {
        console.log("MongoDB connected");
    })
    .catch((err) => {
        console.log("MongoDB Connection Error:", err); // Added context for error logging
    });
    
async function main() {
    // 🔑 FIX ADDED HERE: Add minTlsVersion: 'tls12' to resolve SSL alert 80
    await mongoose.connect(dbUrl, {
        minTlsVersion: 'tls12', 
        // These are commonly required options for modern connections:
        // useNewUrlParser: true,
        // useUnifiedTopology: true,
    }); 
}   

// app.get('/', (req, res) => {
//     res.send("Hi, I am root");
// });

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(express.urlencoded({ extended: true }));
app.use(methodOverride('_method'));
app.engine('ejs', ejsMate);
app.use(express.static(path.join(__dirname, 'public')));

const store = MongoStore.create({
    mongoUrl: dbUrl,
    crypto: {
        secret:process.env.SECRET,
    },
    touchAfter: 24 * 3600,
});

store.on("error", (err) =>{ // Corrected store.on error handler to use 'err'
    console.log("ERROR in MONGO SESSION STORE", err);
})

const sessionOptions = {
    store,
    secret: process.env.SECRET,
    resave: false,
    saveUninitialized: true,
    cookie:{
        expires: Date.now() + 7 * 24 * 60 * 60 * 1000, // 7 days
        maxAge: 7 * 24 * 60 * 60 * 1000 ,// 7 days
        httpOnly: true, // Helps prevent XSS attacks
    },

};

const validateReview = (req, res, next) => {
    console.log(req.body);
    // Assuming reviewSchema is defined elsewhere
    let {error} = reviewSchema.validate(req.body);
    
    if (error) {
        let errMsg = error.details.map((el)=> el.message).join(",");
        throw new ExpressError(400,errMsg);
    }else{
        next();
    }  
};


app.use(session(sessionOptions));
app.use(flash());

app.use(passport.initialize());
app.use(passport.session());
passport.use(new LocalStrategy(User.authenticate()));

passport.serializeUser(User.serializeUser());
passport.deserializeUser(User.deserializeUser());

app.use((req, res, next) => {
    res.locals.success = req.flash('success');
    res.locals.error = req.flash('error');
    res.locals.currUser = req.user;
    next();
});


app.use('/listings', listingsRouter);
app.use('/listings/:id/reviews',reviewRouter); 
app.use('/', userRouter);


app.all('*', (req, res, next) => {
    next(new ExpressError(404, "Page Not Found !"));
});

app.use((err, req, res, next) => {
    let { statusCode=500, message="Something went wrong!" } = err;
    res.status(statusCode).render('error.ejs',{message} );
   // res.status(statusCode).send(message);
});
app.listen(8080, () => {
    console.log("Server is running on port 8080");
});
