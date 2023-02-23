const express = require("express")
const app = express()
const cors = require("cors")
const mongoose = require("mongoose")
const dotenv = require("dotenv").config()
const bcrypt = require("bcryptjs")
const jwt = require("jsonwebtoken")
const random = require("randomstring")
const nodemailer = require("nodemailer")
const {users, conversations} = require("./model")


const URL = process.env.URL
const SECRET = process.env.SECRET
const USER = process.env.USER
const PASS = process.env.PASS


mongoose.set("strictQuery",false)
mongoose.connect(URL)
app.use(express.json())
app.use(cors())

const sendEmail = async(req,res,temp) =>{
    try {
        let transporter = nodemailer.createTransport({
            host:"smtp.gmail.com",
            port:587,
            secure:false,
            auth:{
                user:USER,
                pass: PASS
            }
        })

        let info = await transporter.sendMail({
            from:USER,
            to:req.body.email,
            subject:"Temporary password from chatbot",
            html:`<p>Your temporary password is  <b>${temp}</b></p>
                  <p>Copy the temporary password and submit it by clicking the 
                  temporary password link in the forgot password page</p>`
        })
        res.json({message:`Temporary password sent to ${req.body.email}`})
        
    } catch (error) {
        res.status(500).json({message:"Something went wrong,Please try again"}) 
    }
}

app.post("/register",async(req,res) =>{req.body
    try {
        let user = await users.findOne({email:req.body.email})
        if(!user){
          let salt = await bcrypt.genSalt(10)
          let hash = await bcrypt.hash(req.body.password,salt)
          req.body.password = hash

         let user = await users.create(req.body)
        
          res.json({message:"Account created successfully"})
        }else{
            res.status(409).json({message:"Already an user registered with this email id"})
        }
    } catch (error) {console.log(error);
         res.status(500).json({message:"Something went wrong,Please try again"})
    }
})

app.post("/login",async(req,res) =>{
    try {
        let user = await users.findOne({email:req.body.email})
        if(user){
            let compare = await bcrypt.compare(req.body.password,user.password)
            if(compare){
               let token = jwt.sign({id:user._id},SECRET,{expiresIn:"3d"})
               let {_id,name,email,profilePicture} = user
               let userDetails ={_id,name,email,profilePicture}
               res.json({token,user:userDetails})
            }else{
                res.status(401).json({message:"Email id or password is incorrect"})  
            }
        }else{
            res.status(401).json({message:"Email id or password is incorrect"})
        }
    } catch (error) {console.log(error);
        res.status(500).json({message:"Something went wrong,Please try again"})
    }
})

app.post("/forgot",async(req,res) =>{
    try {
        let user = await users.findOne({email:req.body.email})
        if(user){
          let temp = random.generate(10)
          user.temporary = temp
          await user.save()
          sendEmail(req,res,temp)
        }else{
            res.status(401).json({message:"Email id is incorrect"})
        }
    } catch (error) {
        res.status(500).json({message:"Something went wrong,Please try again"})
    }
})

app.post("/temporarypass",async(req,res) =>{
    try {
        let user = await users.findOne({email:req.body.email})
        if(user){
            if(user.temporary){
                if(req.body.password === user.temporary) {
                    
                    res.json({message:"Please update your password immediately"})
                }
            }else{
                res.status(401).json({message:"Please create a temporary password"})
            }            
        }else{
            res.status(401).json({message:"Email id is incorrect"}) 
        }
    } catch (error) {
        res.status(500).json({message:"Something went wrong,Please try again"})
    }
})

app.post("/resetpass",async(req,res) =>{
    try {
        let user = await users.findOne({email:req.body.email})
        if(user){
            let salt = await bcrypt.genSalt(10)
            let hash = await bcrypt.hash(req.body.password,salt)
            user.password = hash
            await user.save()
            await users.findOneAndUpdate({email:req.body.email},{$unset:{temporary:""}})
            res.json({message:"Password updated successfully"})
        }else{
            res.status(401).json({message:"Email id is incorrect"}) 
        }
    } catch (error) {
        res.status(500).json({message:"Something went wrong,Please try again"})
    }
})

app.get("/searchFriends/:name",async(req,res) =>{
    try{
      let regexp = new RegExp(`${req.params.name}`,"i")

      let list = await users.find({name:{$regex:regexp}},{name:1,profilePicture:1})
      res.json(list)
    }catch(error){
        res.status(500).json({message:"Something went wrong,Please try again"})
    }
})

app.post("/addMessage",async(req,res) => {
    try { 
        let message = await conversations.create(req.body)
        
        res.json({message:message.message,
                 sender:message.sender})
    } catch (error) {console.log(error);
        res.status(500).json({message:"Something went wrong,Please try again"})
    }
})

app.get("/chatList/:userId",async(req,res) =>{
    try {
        let entries = await conversations.find({members:{$in:[req.params.userId]}},{_id:0,members:1})
        
        let list = entries.reduce((acc,e) =>{
            let friend = e.members.filter(e =>String(e) !== req.params.userId)
            if(friend.length === 0) friend = [e.members[0]]
             if(! acc.includes(String(friend[0]))) acc.push(String(friend[0]))
             return acc
        },[])
      
      let user = await users.findById(req.params.userId)
      user.chatList = list
      await user.save()
      
       let populateUser = await users.findById(req.params.userId).populate("chatList",["name","profilePicture"])
       
      res.json(populateUser.chatList)
    } catch (error) {
        res.status(500).json({message:"Something went wrong,Please try again"})
    }
})

app.get("/getMessages",async(req,res) => {
    try {
        if(req.query.user === req.query.friend){
            let messages = await conversations.find({members:[req.query.user,req.query.friend]},{_id:0,message:1,sender:1,createdAt:1})
            res.json(messages)
        }else{
            let messages = await conversations.find({members:{$all:[req.query.user,req.query.friend]}},{_id:0,message:1,sender:1,createdAt:1})
            res.json(messages)
        }
        
    } catch (error) {
        res.status(500).json({message:"Something went wrong,Please try again"})
    }
})

app.listen(process.env.PORT || 3001)