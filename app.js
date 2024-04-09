require('dotenv').config();
const express = require("express");
const bodyParser = require("body-parser");
const ejs = require("ejs");
const mongoose = require('mongoose');
const session = require("express-session");
const passport = require("passport");
const passportLocalMongoose = require("passport-local-mongoose");

const app = express();
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({
    extended: true
}));
app.use(express.static(__dirname+'/public'));
app.set('view engine','ejs');
app.use(session({
    secret: "abcd",
    resave: false,
    saveUninitialized: false
}));
app.use(passport.initialize());
app.use(passport.session());


mongoose.connect("mongodb://127.0.0.1:27017/studentDB");

//////////////////////////////////////////////////////////////////////

// Schema

const userSchema = new mongoose.Schema({
    username: String,
    std_id: Number,
    email: String,
    password: String
});
userSchema.plugin(passportLocalMongoose);
const User = new mongoose.model("User", userSchema);
passport.use(User.createStrategy());
passport.serializeUser(User.serializeUser());
passport.deserializeUser(User.deserializeUser());


const courseSchema = new mongoose.Schema({
    course_code: String,
    course_title: String,
    prerequisite: String,
    day1: String,
    day2: String,
    time: String,
    remaining_seats: Number,
    faculty: String
},
{
    collation: { locale: 'en', strength: 2 }
 });
const Course = mongoose.model("Course", courseSchema);


const gradeSchema = new mongoose.Schema({
    std_id: Number,
    course_code: String,
    grade: Number,
    semester: String
});
const Grade = mongoose.model("Grade", gradeSchema);


const semesterPlanSchema = new mongoose.Schema({
    semester: String,
    std_id: Number,
    course1_code: String,
    course2_code: String,
    course3_code: String,
    course4_code: String,
});
const SemesterPlan = mongoose.model("SemesterPlan", semesterPlanSchema);

//////////////////////////////////////////////////////////////////////

// ADMIN Features

app.post("/setSubmitCourse",function(req,res){

    const newCourse = new Course({
        course_code: req.body.course_code,
        course_title: req.body.course_title,
        prerequisite: req.body.prerequisite,
        day1: req.body.day1,
        day2: req.body.day2,
        time: req.body.time,
        remaining_seats: req.body.remaining_seats,
        faculty: req.body.faculty
    });
    newCourse.save();
    res.redirect("/adminPanel");
});

app.post("/setSubmitGrade", function(req,res){

    const newGrade = new Grade({
        std_id: req.body.std_id,
        course_code: req.body.course_code,
        grade: req.body.grade,
        semester: req.body.semester
    });
    newGrade.save();
    res.redirect("/loadAddGrade");
});

app.get("/adminPanel",function(req,res){
    res.render("adminPanel");
});

app.get("/loadAddGrade",function(req,res){
    res.render("addGradePage");
});

app.get("/loadAddCourse",function(req,res){
    res.render("addCoursePage");
});

app.get("/studentList",function(req,res){
    User.find({},function(err,result){
        res.render("showStudentList",{studentList:result});
    });
});

/////////////////////////////////////////////////////////////////////////

// Faculty Features

app.post("/updateRoutine",function(req,res){
    Course.findOneAndUpdate({course_code:req.body.course_code},{day1:req.body.day1,day2:req.body.day2,time:req.body.time},function(err,ye){if(err){console.log(err)}});
    res.redirect("/facultyDash");
});

app.post("/doAdvising",function(req,res){
    SemesterPlan.findOneAndUpdate({semester:req.body.semester, std_id:req.body.std_id},
        {course1_code:req.body.course1_code,
            course2_code:req.body.course2_code,
            course3_code:req.body.course3_code,
            course4_code:req.body.course4_code
        },function(err,ye){if(err){console.log(err)}});
        res.redirect("/facultyDash");
});

app.post("/checkStudentGrade",function(req,res){
    Grade.find({std_id:req.body.std_id},function(err,result){
        var gradeSum = 0;
        for(let i=0; i<result.length; i++)
        {
            gradeSum += Number(result[i].grade);
        }
        var cgpa = (gradeSum/result.length).toFixed(2);       
        
        res.render("gradeSheet",{gradeSheet:result, cgpa:cgpa});
    });
});

app.get("/updateRoutine",function(req,res){
    res.render("updateRoutine");
});

app.get("/doAdvising",function(req,res){
    res.render("doAdvising");
});

app.get("/studentQuery",function(req,res){
    res.render("studentQuery");
});

app.get("/facultyDash",function(req,res){
    res.render("facultyDash");
});
////////////////////////////////////////////////////////////////////////

app.post("/submitAdvising", async function(req,res){

    async function checkForAdvising(course_code,std_id){
    
        async function getData() {
            const query = Course.find({course_code:course_code});
            const value = await query.exec();
            return value;
          }
          const courseInfo = await getData();

          const preReq = courseInfo[0].prerequisite;
          const remainingSeats = courseInfo[0].remaining_seats;

        async function checkDone() {
            const query = Course.find({std_id:std_id,course_code:preReq});
            const value = await query.exec();
            return value;
          }
        const check = await checkDone();
          
        // Non fresher
        if(remainingSeats>0 && check.length != 0){
            return true;
        }
        // Fresher
        else if(remainingSeats>0 && preReq=="none"){
            return true;
        }
        else{return false;}
    
    }

    var eligibleCount = 0;
    if(await checkForAdvising(req.body.course1_code, req.body.std_id)){eligibleCount+=1;}
    if(await checkForAdvising(req.body.course2_code, req.body.std_id)){eligibleCount+=1;}
    if(await checkForAdvising(req.body.course3_code, req.body.std_id)){eligibleCount+=1;}
    if(await checkForAdvising(req.body.course4_code, req.body.std_id)){eligibleCount+=1;}
    console.log(eligibleCount);

    if(eligibleCount==4){
        await Course.updateOne({course_code:req.body.course1_code},{$inc:{remaining_seats:-1}});
        await Course.updateOne({course_code:req.body.course2_code},{$inc:{remaining_seats:-1}});
        await Course.updateOne({course_code:req.body.course3_code},{$inc:{remaining_seats:-1}});
        await Course.updateOne({course_code:req.body.course4_code},{$inc:{remaining_seats:-1}}); 

        const newSemesterPlan = new SemesterPlan({
            semester: req.body.semester,
            std_id: req.user.std_id,
            course1_code: req.body.course1_code,
            course2_code: req.body.course2_code,
            course3_code: req.body.course4_code,
            course4_code: req.body.course4_code,
        });
        await newSemesterPlan.save();
        res.render("advising")
    }
    else{
        res.render("advising failed");
    }
    
});

/*app.post("/searchCourseInfo",function(req,res){
    Course.find({course_code:req.body.course_code},function(err,result){
        res.render("searchResult",{searchResult:result});
    });
});*/



app.get("/gradeSheet",function(req,res){
    Grade.find({std_id:req.user.std_id},function(err,result){
        var gradeSum = 0;
        for(let i=0; i<result.length; i++)
        {
            gradeSum += Number(result[i].grade);
        }
        var cgpa = gradeSum/result.length
        res.render("gradeSheet",{gradeSheet:result, cgpa:cgpa});
    });
});

app.get("/courseList",function(req,res){
    Course.find({},function(err,result){
        res.render("showCourseList",{courseList:result});
    });
});

app.get("/semesterInfo",function(req,res){
    SemesterPlan.find({std_id:req.user.std_id},function(err,result){
        res.render("semesterInfo",{semesterData:result});
    });
});

app.get("/userInfo",function(req,res){
    User.find({std_id:req.user.std_id},function(err,result){
        res.render("userInfo",{userInfo:result});
    });
});

app.get("/advising",function(req,res){
    res.render("advising");
});

/////////////////////////////////////////////////////////////////////////////

// APP Features

app.post("/", function(req,res){
    
    const user = new User({
        username: req.body.username,
        password: req.body.password
    });
    
    req.login(user, function(err){
        if(err){
            res.redirect("/");
        } else {
            passport.authenticate("local")(req,res,function(){
                if(req.user._id == "639570523e857606c85140a0"){
                    res.redirect("/adminPanel");
                }
                else if(req.user._id == "639e9df154cec19e36881f50") {
                    res.redirect("/facultyDash");
                }
                else{
                res.redirect("/home");
                }
            });
        }
    });
});

app.post("/register", function(req,res){
    User.register(new User({username: req.body.username, std_id: req.body.std_id, email: req.body.email}), req.body.password, function(err,user){
        if(err){
            console.log(err);
            res.redirect("/register");
        } else {
            passport.authenticate("local")(req,res,function(){
                res.redirect("/home");
            });
        }
    });
});

app.get("/register", function(req,res){
    res.render("register");
});

app.get("/", function(req,res){
    res.render("login");
});

app.get("/logout",function(req,res){
    req.logout(function(err) {
        if (err) { return next(err); }
        res.redirect("/");
      });
});

app.get("/home",function(req,res){
    res.render("home");
});

///////////////////////////////////////////////
app.listen(4000,function(){
    console.log("server started on port 4000");
});