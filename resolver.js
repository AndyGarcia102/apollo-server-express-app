const Users = require('./models/Users.model');
const Professors = require('./models/Professors.model');
const Group = require('./models/Group.model');
const Coordinator = require('./models/Coordinator.model');
const Auth = require('./models/Auth.model');
const UserInfo = require('./models/UserInfo.model');
const CoordSchedule = require('./models/CoordSchedule.model');
const {ApolloError} = require('apollo-server-errors');
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const nodemailer = require("nodemailer");
const Mongoose = require('mongoose');
const { ObjectId, default: mongoose } = require('mongoose');

const STUDENT_EMAIL = new RegExp('^[a-z0-9](\.?[a-z0-9]){2,}@k(nights)?nights\.ucf\.edu$');
const PROFESSOR_EMAIL = new RegExp('^[a-z0-9](\.?[a-z0-9]){2,}@gmail\.com$');

const resolvers = {


    Query:{
        getUser: async(_,{ID}) => {
            return await Users.findById(ID);
        },
        getAllUsers: async () => {
            return await Users.find();
        },   
        getProfessor: async(_,{ID}) => {
            return await Professors.findById(ID);
        },
        getAllProfessors: async () => {
            return await Professors.find();
        },
        getAllGroups: async() => {

            return await Group.aggregate([
                {$lookup:
                    {   from:"users", 
                        localField: "members",
                        foreignField:"_id", 
                        as:"members"
                    }
                }]);
        },
        availSchedule: async() =>{
            return Professors.aggregate([

                /* KEEP just in case I decide to turn this into it's own viewCollection  */

                // {$group:{_id:"$availSchedule",pId:{$push:{_id:"$_id", name:{$concat:["$professorFName", " ", "$professorLName"]}}}}},
                // {$unwind:"$_id"},
                // {$group:{_id:"$_id", pId:{$push:"$pId"}}},
                // {$unwind:"$pId"},
                // {$unwind:"$pId"},
                // {$group:{_id:"$_id", pId:{$addToSet:"$pId"}}},
                // {$sort:{_id:1}}

                {$group:{_id:"$availSchedule",pId:{$push:{_id:"$_id", name:{$concat:["$professorFName", " ", "$professorLName"]}}}}},
                {$unwind:"$_id"},
                {$group:{_id:"$_id", pId:{$push:"$pId"}}},
                {$project:{_id:1, pId: {$reduce:{input:'$pId', initialValue:[], in:{$concatArrays:['$$value','$$this']}}}}},
                {$sort:{_id:1}}
            ]);
        },
        availScheduleByGroup: async(_,{date}) => {

            const dateConversion = new Date(date).toISOString();
            const viewDate = new Date(dateConversion);

            return Professors.aggregate([
                {$group:{_id:"$availSchedule",pId:{$push:{_id:"$_id", name:{$concat:["$professorFName", " ", "$professorLName"]}}}}},
                {$unwind:"$_id"},
                {$group:{_id:"$_id", pId:{$push:"$pId"}}},
                {$match:{_id:viewDate}},
                {$project:{_id:1, pId: {$reduce:{input:'$pId', initialValue:[], in:{$concatArrays:['$$value','$$this']}}}}},
                {$sort:{_id:1}}
            ]);
        },
        getAllCoordinatorSchedule: async() =>{

            return await CoordSchedule.find()
        },
        getCoordinatorSchedule: async(_,{coordinatorID}) =>{
            const CID = coordinatorID
            return await CoordSchedule.find({coordinatorID:CID}).sort({time:1})
        }
    },
    Mutation:{
        registerCoordinator: async(_,{registerInput: {firstname,lastname, email, password, confirmpassword}}) =>{
            if (password !== confirmpassword){
                throw new ApolloError("Passwords Do Not Match");
            }
            if(password === "" || firstname === "" || lastname === "" || email === ""){
                throw new ApolloError("Please fill in all of the Boxes!");
            }

            // See if an old user or Professor exists with Email attempting to Register
            // const oldUser = await Users.findOne({email});
            const doesExist = await UserInfo.findOne({email:email});

            if(doesExist){
                // throw an error 
                throw new ApolloError("A user is already reigstered with the email " + email, "USER_ALREADY_EXISTS");
            }


            var encryptedPassword = await bcrypt.hash(password,10);
        
                // Build out mongoose model 
                const newCoordinator = new Coordinator({
                    coordinatorFName:firstname.toLowerCase(),
                    coordinatorLName:lastname.toLowerCase(),
                });
        
                // create JWT (attach to user model)
                const token = jwt.sign(
                    {id : newCoordinator._id, email}, 
                    "UNSAFE_STRING", // stored in a secret file 
                    {
                        expiresIn: "1d"
                    }
                );
                
                // Save user in MongoDB
                const res = await newCoordinator.save();

                // create professors auth information in separate collection called Auth
                const authCoordinator = new Auth({
                    userId: res._id,
                    password: encryptedPassword,
                    confirm: false,
                    privilege: "coordinator",
                    token: token
                })

                // save new professor profile
                await authCoordinator.save();
                
                // create model for professors information 
                const coordinatorInfo = new UserInfo({
                    userId:res._id,
                    email: email.toLowerCase(),
                    image:'',
                    privilege: "coordinator"
                })

                await coordinatorInfo.save();
        
                return{
                    firstname: res.userFName,
                    lastname: res.userLName,
                    email: coordinatorInfo.email,
                    privilege: coordinatorInfo.privilege,
                    password: authCoordinator.password,
                    confirm: authCoordinator.confirm,
                    token: authCoordinator.token
                }


        },
        registerUser: async(_,{registerInput: {firstname,lastname, email, password, confirmpassword}}) =>{

            if (password !== confirmpassword){
                throw new ApolloError("Passwords Do Not Match");
            }
            if(password === "" || firstname === "" || lastname === "" || email === ""){
                throw new ApolloError("Please fill in all of the Boxes!");
            }
            // See if an old user or Professor exists with Email attempting to Register
            // const oldUser = await Users.findOne({email});
            const oldProfessor = await UserInfo.findOne({email:email});
            const oldUser = await UserInfo.findOne({email:email});
    
            if(oldProfessor || oldUser){
                // throw an error 
                throw new ApolloError("A user is already reigstered with the email " + email, "USER_ALREADY_EXISTS");
            }

            let transport = nodemailer.createTransport({ 
                service: "Gmail", 
                host:process.env.EMAIL_USERNAME,
                secure: false,
                auth: { 
                    user: process.env.EMAIL_USERNAME, 
                    pass: process.env.EMAIL_PASSWORD 
                }, 
            
            });





            if(STUDENT_EMAIL.test(email)){

                console.log(`Student: ${STUDENT_EMAIL.test(email)}`);
                
                // Encrypt password using bcryptjs
                var encryptedPassword = await bcrypt.hash(password,10);
        
                // Build out mongoose model 
                const newStudent = new Users({
                    userFName:firstname.toLowerCase(),
                    userLName:lastname.toLowerCase(),
                    role: "",
                    groupNumber:0,
                });
        
                // create JWT (attach to user model)
                const token = jwt.sign(
                    {id : newStudent._id, email}, 
                    "UNSAFE_STRING", // stored in a secret file 
                    {
                        expiresIn: "1d"
                    }
                );
                
                // Save user in MongoDB
                const res = await newStudent.save();

                // create professors auth information in separate collection called Auth
                const authStudent = new Auth({
                    userId: res._id,
                    password: encryptedPassword,
                    confirm: false,
                    privilege: "student",
                    token: token
                })

                // save new professor profile
                await authStudent.save();
                
                // create model for professors information 
                const studentInfo = new UserInfo({
                    userId:res._id,
                    email: email.toLowerCase(),
                    image:''
                })

                await studentInfo.save();

                transport.sendMail({
                    from: "group13confirmation@gmail.com",
                    to: email,
                    subject: "mySDSchedule - Please Confirm Your Account",
                    html: `<h1>Email Confirmation</h1>
                    <h2>Hello ${firstname}</h2>
                    <p>Thank you for Registering!</p>
                    <p>To activate your account please click on the link below.</p>
                    
                    <p>Please Check you Junk/Spam folder</p>
                    </div>`,
                    //<a href=https://cop4331-group13.herokuapp.com/api/confirm?confirmationcode=${token}> Click here</a>
                })
        
                return{
                    firstname: res.userFName,
                    lastname: res.userLName,
                    email: studentInfo.email,
                    privilege: studentInfo.privilege,
                    password: authStudent.password,
                    confirm: authStudent.confirm,
                    token: authStudent.token

                }

            } else if(!STUDENT_EMAIL.test(email)){

                console.log(`Student: ${STUDENT_EMAIL.test(email)}`);
                console.log(`Professor: ${PROFESSOR_EMAIL.test(email)}`);
                
                // Encrypt password using bcryptjs
                var encryptedPassword = await bcrypt.hash(password,10);
        
                // Build out mongoose model 
                const newProfessor = new Professors({
                    professorFName:firstname.toLowerCase(),
                    professorLName:lastname.toLowerCase()
                });
        
                // create JWT (attach to user model)
                const token = jwt.sign(
                    {id : newProfessor._id, email}, 
                    "UNSAFE_STRING", // stored in a secret file 
                    {
                        expiresIn: "1d"
                    }
                );
                
                // Save user in MongoDB
                const res = await newProfessor.save();

                // create professors auth information in separate collection called Auth
                const authProfessor = new Auth({
                    userId: res._id,
                    password: encryptedPassword,
                    confirm: false,
                    token: token
                })

                // save new professor profile
                await authProfessor.save();
                
                // create model for professors information 
                const professorInfo = new UserInfo({
                    userId:res._id,
                    email: email.toLowerCase(),
                    image:'',
                    privilege:"professor"
                })

                await professorInfo.save();

                transport.sendMail({
                    from: "group13confirmation@gmail.com",
                    to: email,
                    subject: "mySDSchedule - Please Confirm Your Account",
                    html: `<h1>Email Confirmation</h1>
                    <h2>Hello ${firstname}</h2>
                    <p>Thank you for Registering!</p>
                    <p>To activate your account please click on the link below.</p>
                    
                    <p>Please Check you Junk/Spam folder</p>
                    </div>`,
                    //<a href=https://cop4331-group13.herokuapp.com/api/confirm?confirmationcode=${token}> Click here</a>
                })
        
                return{
                    id:res._id,
                    firstname: res.professorFName,
                    lastname: res.professorLName,
                    email: professorInfo.email,
                    privilege: professorInfo.privilege,
                    password: authProfessor.password,
                    confirm: authProfessor.confirm,
                    token: authProfessor.token

                }

            }else{
                throw new ApolloError("Invalid Email " + email, " EMAIL IS NOT VALID");
            }
    
        },
        loginUser: async (_,{loginInput: {email, password}}, contextValue ) => {

            console.log("contextValue");
            console.log(contextValue);

            if(!STUDENT_EMAIL.test(email)){

                
                const professorsInfo = await UserInfo.findOne({email});
                const professorsAuth = await Auth.findOne({userId:professorsInfo.userId});
                const professors = await Professors.findOne({_id:professorsInfo.userId});
                const coordinator = await Coordinator.findOne({_id:professorsInfo.userId});
              


                if(professors && professorsInfo && professorsAuth.confirm === true && (await bcrypt.compare(password, professorsAuth.password))){

                    // create a new token ( when you login you give user a new token )
                    const token = jwt.sign(
                        {
                            id : professors._id, 
                            email, 
                            firstname: professors.professorFName, 
                            lastname: professors.professorLName,
                            privilege: professorsInfo.privilege
                        }, 
                        "UNSAFE_STRING", // stored in a secret file 
                        {expiresIn: "1d"}
                    );
    
                    // attach token to user model that we found if user exists 
                    await Auth.findOneAndUpdate({userId:professors._id}, {$set:{token:token}})
    
                    return {
                        _id: professors._id,
                        firstname:professors.professorFName,
                        lastname:professors.professorLName,
                        email: professorsInfo.email,
                        token: professorsAuth.token,
                        privilege: professorsInfo.privilege
                    }          
                }else if(coordinator && professorsInfo && professorsAuth.confirm === true && (await bcrypt.compare(password, professorsAuth.password))){
                    // create a new token ( when you login you give user a new token )
                    const token = jwt.sign(
                        {
                            id : coordinator._id, 
                            email, 
                            firstname: coordinator.professorFName, 
                            lastname: coordinator.professorLName,
                            privilege: professorsInfo.privilege
                        }, 
                        "UNSAFE_STRING", // stored in a secret file 
                        {expiresIn: "1d"}
                    );
    
                    // attach token to user model that we found if user exists 
                    await Auth.findOneAndUpdate({userId:coordinator._id}, {$set:{token:token}})
    
                    return {
                        _id: coordinator._id,
                        firstname:coordinator.coordinatorFName,
                        lastname:coordinator.coordinatorLName,
                        email: professorsInfo.email,
                        token: professorsAuth.token,
                        privilege: professorsInfo.privilege
                    } 

                }else{
                    throw new ApolloError("Something Went Wrong");
                }
            }else if (STUDENT_EMAIL.test(email)){
               
                // 3 small queries are faster than joining all 3 then searching
                const studentInfo = await UserInfo.findOne({email});
                const studentAuth = await Auth.findOne({userId:studentInfo.userId});
                const student = await Users.findOne({_id:studentInfo.userId});

                if(studentInfo && studentAuth.confirm === true && (await bcrypt.compare(password, studentAuth.password))){

                    // create a new token ( when you login you give user a new token )
                    const token = jwt.sign(
                        {
                            id : student._id, 
                            email, 
                            firstname: student.userFName, 
                            lastname: student.userLName,
                            privilege: studentInfo.privilege
                        }, 
                        "UNSAFE_STRING", // stored in a secret file 
                        {expiresIn: "1d"}
                    );
    
                    // attach token to user model that we found if user exists 
                    await Auth.findOneAndUpdate({userId:student._id}, {$set:{token:token}})
    
                    return {
                        _id: student._id,
                        firstname:student.userFName,
                        lastname:student.userLName,
                        email: studentInfo.email,
                        token: studentAuth.token,
                        privilege: studentInfo.privilege
                    }          
                }
            }
        },
        // confirm email if valid, then provide another api to actually set the api.
        confirmEmail: async(_,{confirmEmail:{email}}) => {

            // check if email is valid 
            if(STUDENT_EMAIL.test(email)){
                try{
                    // check if email is valid 
                    const isValidEmail = await Users.findOne({email});
                    
                    // set up email 
                    let transport = nodemailer.createTransport({ service: "Gmail", auth: { user: process.env.EMAIL_USERNAME, pass: process.env.EMAIL_PASSWORD }, });

                    // send email to user. 
                    transport.sendMail({
                        from: "group13confirmation@gmail.com",
                        to: email,
                        subject: "mySDSchedule - Please Confirm Your Account",
                        html: `<h1>Email Confirmation</h1>
                        <h2>Hello ${isValidEmail.firstname} ${isValidEmail.lastname}</h2>
                        <p>Click Link to reset your password!</p>
                        <p>If you did not select to reset your password please ignore this email</p>
                        </div>`,
                        //<a href=https://cop4331-group13.herokuapp.com/api/confirm?confirmationcode=${token}> Click here</a>
                    })
                }catch(e){
                    // email is not valid 
                    throw new ApolloError("Email IS Not Valid");
                }

            }else if(PROFESSOR_EMAIL.test(email)){
                try{
                    // check if email is valid 
                    const isValidEmail = await Professors.findOne({email}, {_id:1, email:1, firstname:1, lastname:1});
                    
                    // set up email 
                    let transport = nodemailer.createTransport({ service: "Gmail", auth: { user: process.env.EMAIL_USERNAME, pass: process.env.EMAIL_PASSWORD }, });

                    // send email to user. 
                    transport.sendMail({
                        from: "group13confirmation@gmail.com",
                        to: email,
                        subject: "mySDSchedule - Please Confirm Your Account",
                        html: `<h1>Email Confirmation</h1>
                        <h2>Hello ${isValidEmail.firstname} ${isValidEmail.lastname}</h2>
                        <p>Click Link to reset your password!</p>
                        <p>If you did not select to reset your password please ignore this email</p>
                        </div>`,
                        //<a href=https://cop4331-group13.herokuapp.com/api/confirm?confirmationcode=${token}> Click here</a>
                    })
                }catch(e){
                    // email is not valid 
                    throw new ApolloError("Email IS Not Valid");
                }
            }
        },
        resetPassword: async(_,{resetPassword:{email,password,confirmPassword}}) =>{

            // encrypt new password and set to user.
            if(password !== confirmPassword){
                throw new ApolloError("Passwords Do Not Match!");
            }
            
            if(STUDENT_EMAIL.test(email)){
                 try{
                    // encrypt password
                    const encryptedPassword = await bcrypt.hash(password,10);
                    
                    // set password from user 
                    const setNewPassword = await Users.findOneAndUpdate({email:email}, {password: encryptedPassword, confirmpassword: encryptedPassword });

                    setNewPassword.save();
            
                }catch(e){
                     throw new ApolloError("Email is Invalid");
                 }
            }else if (PROFESSOR_EMAIL.test(email)){
                try{
                    // encrypt password
                    const encryptedPassword = await bcrypt.hash(password,10);
                    
                    // set password from user 
                    const setNewPassword = await Professors.findOneAndUpdate({email:email}, {password: encryptedPassword, confirmpassword: encryptedPassword });
                    
                    setNewPassword.save();
            
                }catch(e){
                    throw new ApolloError("Email is Invalid");
                }
            }

        },

        // might take out if statement to differ between professor and coordinator
        // depends if we will have a separate register for coordinator
        createProfessorSchedule: async(_,{ID,privilege,professorScheduleInput:{time}}) => {   

            if(ID === null || privilege === null){
                throw new ApolloError("Missing Field Data");
            }else{
                privilege === "professor" || "coordinator" ? await addDateHelper(time, privilege) : "Privilege Error in Schedule";

                async function addDateHelper(time, privilege){
                    const dates = [];
                    let UniqueTimes = new Set(time);
            
                    UniqueTimes.forEach((times) =>{
                            times = new Date(times).toISOString();
                            dates.push(new Date(times));
                    })
                
                if(privilege === "professor"){
                    const isScheduled = (await Professors.find({_id:ID, availSchedule:{$in:dates}}).count());

                    if(!isScheduled){
                        (await Professors.updateOne({_id:ID},{$push:{availSchedule:{$each: dates}}})).modifiedCount;
                    }else{
                        return false;
                    }
                }else{
                    const isScheduled = (await Coordinator.find({_id:ID, availSchedule:{$in:dates}}).count());
                    if(!isScheduled){
                     (await Coordinator.updateOne({_id:ID},{$push:{availSchedule:{$each: dates}}})).modifiedCount;
                    }else{
                        return false;
                    }
                }
            }
        }
            return true;
        },
        createCoordinatorSchedule: async (_,{coordinatorSInput:{CID, Room,Times}})=>{

            if(Room === null || Times === null){
                throw new ApolloError("Please Fill Room/Times");
            }

            
            
            const ID = Mongoose.Types.ObjectId(CID)
            const UniqueTimes = new Set(Times);
            UniqueTimes.forEach(async(time) => {
                let t = new Date(time).toISOString();
                let duplicateTime = (await CoordSchedule.findOne({time:t}).count());
                
                if(duplicateTime){
                    // throw new ApolloError("Time Splot is Already assigned"); <-- break server if thrown
                    return false;
                }else{
                    try{
                        const CoordinatorSchedule = new CoordSchedule({
                            coordinatorID:ID,
                            room:Room,
                            //groupId: 0, wholey unessary due to the nature of $set
                            time: t,
                            numberOfAttending: 0, // nessecity debatable
                            attending:[]
                        });
                        
                        await CoordinatorSchedule.save();
                    
                    }catch(e){
                        throw new ApolloError("Something Went Wrong!");
                    }
    
                }
            });
   
            return true;    
        },
        createGroup: async (_,{groupInfo:{coordinatorId,groupName,projectField, groupNumber}}) =>{

            if(coordinatorId === "" || groupName === "" || projectField === "" || groupNumber == ""){
                throw new ApolloError("Please fill all Fields!");
            }

            // check for unique
            const checkUniqueGroup = await Group.findOne({groupNumber:groupNumber}).count();

            console.log(checkUniqueGroup);

            // if group doesn't exist, make one
            if(!checkUniqueGroup){
            
                const ID = Mongoose.Types.ObjectId(coordinatorId);
                
                // create a new group Document
                const newGroup = new Group({
                    coordinatorId: ID,
                    groupName: groupName,
                    projectField: projectField,
                    groupNumber: groupNumber,
                    memberCount: 0
                });

                // Save user in MongoDB
                const res = await newGroup.save();
                
                // return res
                return{
                    id:res.id,
                    ...res._doc
                }
            }else{
                throw new ApolloError("Group Already Exists!!");
            }
        },
        deleteUser: async(_,{ID}) => {
            const wasDeletedUser = (await Users.deleteOne({_id:ID})).deletedCount;
            return wasDeletedUser;
        }, 
        deleteProfessor: async(_,{ID}) =>{
            const wasDeletedProfessor = (await Professors.deleteOne({_id:ID})).deletedCount;
            return wasDeletedProfessor;
        },
        editUser: async(_,{ID,userInput:{firstname,lastname,email}})=>{
            const  userEdited = (await Users.updateOne({_id:ID},{
                firstname:firstname,
                lastname:lastname,
                email:email
            })).modifiedCount;
            return userEdited;
        },
        editProfessor: async (_,{ID,professorInput:{firstname,lastname,email, coordinator}})=>{
            const professorEdit = (await Professors.updateOne({_id:ID},{
                firstname:firstname,
                lastname:lastname,
                email:email,
                coordinator: coordinator
            })).modifiedCount;
            return professorEdit;
        },
        makeAppointment:async(_,{ID,AppointmentEdit:{ GID,professorsAttending, time,CID }})=>{//adds groupID to appointment largely for testing purposes
            const bookedTest =await CoordSchedule.findOne({groupId:GID})
            const chrono =new Date(time)
            const appointment= await CoordSchedule.findOne({coordinatorID:CID,time:chrono})
            const PE=[];
            console.log(appointment.groupId)
            if(bookedTest)
            {
                if(bookedTest.professorsAttending.length==3)
                { 
                    throw new ApolloError( "group already has an appointment and has all profs");
                }
                if(appointment)
                {
                    if(appointment.groupId && bookedTest.groupId != appointment.groupId  )//could be mongoose.Types.ObjectId(GID)
                    {
                        throw new ApolloError("Appoinment already booked")
                    }
                    if((appointment.numberOfAttending + professorsAttending.length )>3)
                    {
                        throw new ApolloError("To many professors")
                    }
                    
                }
            }
            //claim appointment for the group
            const CoordScheduleEdit=await CoordSchedule.updateOne({coordinatorID:CID, time:chrono },{$set:{groupId: mongoose.Types.ObjectId(GID)}})
            var modification = CoordScheduleEdit.modifiedCount
            //Validate proffesor Availability
            for(prof of professorsAttending){
                const availTest=await Professors.findOne({_id:prof, availSchedule:{$in:[chrono]}})
                if (!availTest){//unavailable
                    const who =await Professors.find({_id:prof})
                    PE.push(who.professorLName)
                    continue
                }
                else{
                    const pro= mongoose.Types.ObjectId(prof);//might make it a try catch
                    await Professors.updateOne({_id:prof},{$pull:{availSchedule:chrono},$push:{appointments:appoinment._id}}).modifiedCount
                    await CoordSchedule.updateOne({coordinatorID:CID, time:chrono},{$push:{attending:pro},$inc:{numberOfAttending:1}})   //add to the attending professor
                    modification=modification +1;
                }
            }
            if(PE.length!=0)
            {
                throw new ApolloError("professor(s)"+PE+"unavailable")
            }
            if (modification>0 )//if make was successful
            {

                //send out notifications
                // set up email 
                /*let transport = nodemailer.createTransport({ service: "Gmail", auth: { user: process.env.EMAIL_USERNAME, pass: process.env.EMAIL_PASSWORD }, });

                //Professor Notification and availability removal

                for(prof of professorsAttending){
                    await Professors.updateOne({_id:prof},{$pull:{availSchedule:chrono},$push:{appointments:appoinment._id}})
                    const notify= await UserInfo.find({userId:prof})
                    // send email to user. 
                    transport.sendMail({
                        from: "SDSNotifier@gmail.com",
                        to: notify.email,
                        subject: "A Senior Design final Review has been schedule",
                        html: `<h1>Demo Notin appointment at ${time}</h2>
                        <p>If you need to cancel please get on the app or visit our website to do so  </p>
                        </div>`,
                        //<a href=https://cop4331-group13.herokuapp.com/api/confirm?confirmationcode=${token}> Click here</a>
                    })
                }
                //Student Notification
                const GN=await Group.find({_id:GID})
                const members= await Users.find({groupNumber:GN.groupNumber})
                members.forEach(async(member)=>{// this for each will be left alone for now
                    const notify=UserInfo.find({userId:member._id})
                    // send email to user. 
                    transport.sendMail({
                        from: "SDSNotifier@gmail.com",
                        to: notify.email,
                        subject: "A Senior Design final Review has been schedule",
                        html: `<h1>Demo Notin appointment at ${time}</h2>
                        <p>If you need to cancel please get on the app or visit our website to do so  </p>
                        </div>`,
                        //<a href=https://cop4331-group13.herokuapp.com/api/confirm?confirmationcode=${token}> Click here</a>
                    })
                })*/
                const changes = await CoordSchedule.find({coordinatorID:CID,time:chrono})
                return {
                    _id: changes._id,
                    coordinatorID:changes.coordinatorID,
                    room:changes.room,
                    groupId:changes.groupId,
                    time:changes.time,
                    attending:changes.attending
                };
            }
            else{// might branch out if more then one
                throw new ApolloError("Unknown error")
            }
        },
        //profAppointmentNotify
        roomChange:async(_,{CID,newRoom})=>{
            const roomEdit= (await CoordSchedule.updateMany({coordinatorID:CID},{
                room:newRoom
            })).modifiedCount
            return
        },
        cancelAppointment:async(_,{cancelation:{CancelerID,ApID,reason}})=>{// passes the ID of the person canceling and the appointment being canceled
            const canceler= await UserInfo.find({userId:CancelerID});//find out whose canceling
            const appointment= await CoordSchedule.find({_id:ApID});//find the information on the appoinment being canceled
            //alternative call with time and CID instead
            //const appointment= await CoordSchedule.find({time:time,coordinatorID:CID})
            //Student i.e. User
            if(canceler.privilege=='student')//np longer need
            {}
            //Professor on a side note for professors the reason flag should be false
            else if(canceler.privilege=='professor')
            {
                time= new Date(appointment.time);
                await Professors.updateOne({_id:canceler._id},{$pull:{appointments:appoinment._id}});
                const group = await Group.find({_id:appointment.groupId})
                await CoordSchedule.updateOne({_id:ApID}, {$pull:{attending:prof._id}})//remove prof from attending. CAN WE USE CANCELER.USERID FOR THIS
                return {
                    Group:group._id,
                    Time:time,
                    Room:appointment.room
                }
            }
            //coordinator
            else if(canceler.privilege=='coordinator')
            {

            }           

           async function emailer(email, time, room){
                let transport = nodemailer.createTransport({ service: "Gmail", auth: { user: process.env.EMAIL_USERNAME, pass: process.env.EMAIL_PASSWORD }, });
                transport.sendMail({
                    from: "SDSNotifier@gmail.com",
                    to: email,
                    subject: "A Senior Design final Review has been canceled",
                    html: `<h1>Demo Notin appointment a ${time} in room ${room}</h2>
                    <p>If you need to cancel please get on the app or visit our website to do so  </p>
                    </div>`,
                    //<a href=https://cop4331-group13.herokuapp.com/api/confirm?confirmationcode=${token}> Click here</a>
                })
            }
            return
        }
    }
}

module.exports = resolvers;


