if(process.env.NODE_ENV != 'production'){
    require('dotenv').config();
    require('dotenv').config({ override: true });
}

const express = require('express');
const app = express();
const mongoose = require("mongoose");
const path = require('path');
const methodOverride = require('method-override');
const ejsMate = require('ejs-mate');
const ExpressError = require('./utils/ExpressError.js');
const session = require('express-session');
const MongoStore = require('connect-mongo'); // ⬅️ NEW: Import MongoStore
const flash = require('connect-flash');
const passport = require('passport');
const LocalStrategy = require('passport-local');
const User = require('./models/user.js');

const listingsRouter = require('./routes/listing.js');
const reviewRouter = require('./routes/review.js');
const userRouter = require('./routes/user.js');

const dbUrl = process.env.ATLASDB_URL;

main()
    .then(() => {
        console.log("MongoDB connected");
    })
    .catch((err) => {
        console.log(err);
    });
    
async function  main() {
    await mongoose.connect(dbUrl);
}   

// app.get('/', (req, res) => {
//      res.send("Hi, I am root");
// });

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(express.urlencoded({ extended: true }));
app.use(methodOverride('_method'));
app.engine('ejs', ejsMate);
app.use(express.static(path.join(__dirname, 'public')));

// -------------------------------------------------------------
// 1. Configure MongoDB Session Store
const store = MongoStore.create({
    mongoUrl: dbUrl,
    // Prevents unnecessary session updates in the database (only updates every 24h unless session data changes)
    touchAfter: 24 * 3600, // time in seconds (24 hours)
    crypto: {
        // Use the same secret for additional encryption layer on the session data itself
        secret: 'mysupersecretcode', 
    },
});

store.on("error", (err) => {
    console.log("SESSION STORE ERROR", err);
});


const sessionOptions = {
    store, // ⬅️ NEW: Pass the MongoDB store here
    secret: 'mysupersecretcode',
    resave: false,
    saveUninitialized: true,
    cookie:{
        expires: Date.now() + 7 * 24 * 60 * 60 * 1000, // 7 days
        maxAge: 7 * 24 * 60 * 60 * 1000 ,// 7 days
        httpOnly: true, // Helps prevent XSS attacks
    },

};
// -------------------------------------------------------------


const validateReview = (req, res, next) => {
    console.log(req.body);
    let {error} = reviewSchema.validate(req.body);
    
    if (error) {
        let errMsg = error.details.map((el)=> el.message).join(",");
        throw new ExpressError(400,errMsg);
    }else{
        next();
    }   
};

app.use(session(sessionOptions)); // Now uses the MongoDB store
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
    
});
app.listen(8080, () => {
    console.log("Server is running on port 8080");
});
