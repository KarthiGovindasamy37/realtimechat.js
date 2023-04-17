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

app.post("/addMessage",async(req,res) => { console.log("Mess",req.body.messageDetails)
    try { 
        let addMessage = await conversations.create(req.body.messageDetails)

        let {message,sender,createdAt,_id,status} = addMessage

        let messageDetails = { message,sender,createdAt,_id,tempId:req.body.tempId,status,timestamp:Date.now(createdAt)}
        console.log(messageDetails);
        res.json(messageDetails)
    } catch (error) {console.log(error);
        res.status(500).json({message:"Something went wrong,Please try again"})
    }
})

app.get("/chatList/:userId",async(req,res) =>{
    try {
        
        let entries = await conversations.find({members:{$in:[req.params.userId]}},{_id:0,members:1,createdAt:1,status:1,sender:1})
        // console.log(entries);

        let newConversationList = []

        entries.forEach(e =>{
            let friend = e.members.filter(e => String(e._id) !== req.params.userId)
          
            if(friend.length > 0){
                let index = newConversationList.findIndex(e => e._id === String(friend[0]))

            if(index > -1){
                if(String(e.sender) !== req.params.userId && e.status === "Delivered"){
                   if(newConversationList[index].newMessage > 0){
                    newConversationList[index].newMessage = newConversationList[index].newMessage + 1
                    newConversationList[index].updatedAt = e.createdAt
                   }else {
                    newConversationList[index].newMessage = 1
                    newConversationList[index].updatedAt = e.createdAt
                   }
                }else{
                    newConversationList[index].updatedAt = e.createdAt
                }
            }else{
                if(String(e.sender) !== req.params.userId && e.status === "Delivered"){
                   newConversationList.push({
                    _id : String(friend[0]),
                    newMessage : 1,
                    updatedAt : e.createdAt
                   })
                }else{
                    newConversationList.push({
                        _id : String(friend[0]),
                        updatedAt : e.createdAt
                    })
                }
                
            }
            }else{
                let index = newConversationList.findIndex(e => e._id === req.params.userId)
                if(index > -1){
                    newConversationList[index].updatedAt = e.createdAt
                }else{
                    newConversationList.push({
                        _id : req.params.userId,
                        updatedAt : e.createdAt
                    })
                }
            }
            
        })

        newConversationList.sort((a,b) => b.updatedAt - a.updatedAt)
        let newChatlist = []
        newConversationList.forEach(e => newChatlist.push(e._id))

        let user = await users.findById(req.params.userId)

        user.newConversation = newChatlist

        await user.save()

        let populateUser = await users.findById(req.params.userId).populate("newConversation",["name","profilePicture"])
// console.log("1",populateUser.newConversation);
        newConversationList.forEach((e,i) =>{
            if(e.newMessage){
                populateUser.newConversation[i].newMessage = e.newMessage
                populateUser.newConversation[i].updatedAt = e.updatedAt
            }else{
                populateUser.newConversation[i].updatedAt = e.updatedAt
            }
        })
        // console.log("2",populateUser.newConversation);
        res.json(populateUser.newConversation)

        // let newConversationList = []
        // entries.forEach(e =>{
        //     let date = new Date(e.createdAt)
        //     let time = date.getTime()
        //     // console.log(date,time,userOffline.offlineTime);
        //     if(time > userOffline.offlineTime){ console.log("it works");
        //     let friend = e.members.filter(e =>String(e) !== req.params.userId)
        //     let index = newConversationList.findIndex(e => String(e._id) === String(friend[0]))
        //     if(index > -1){
        //       newConversationList[index].newMessage =  newConversationList[index].newMessage + 1     
        //       newConversationList[index].createdAt = e.createdAt
        //     }else{
        //         newConversationList.push({
        //             _id : String(friend[0]),
        //             newMessage:1,
        //             createdAt : e.createdAt
        //         })
        //     }
        //     }
            // else{
            // let friend = e.members.filter(e =>String(e) !== req.params.userId)
            // if(friend.length === 0) friend = [e.members[0]]
            //  if(! list.includes(String(friend[0]))) list.push(String(friend[0]))
            // }
        // })
        // console.log("newConversationList",newConversationList);

        // if(newConversationList.length > 0){
        //     newConversationList.sort((a,b) => b.createdAt - a.createdAt)
        //     let newList = []
        //     newConversationList.forEach(e => newList.push(e._id))

        //     let user = await users.findById(req.params.userId)
        //     user.newConversation = newList
        //     await user.save()

        //     let populateUser = await users.findById(req.params.userId).populate("newConversation",["name","profilePicture"])

        //     newConversationList.forEach(e => {
        //         let index = populateUser.newConversation.findIndex(chat => String(chat._id) === e._id)
        //         populateUser.newConversation[index].newMessage = e.newMessage
        //     })
// console.log("populateUser.newConversation",populateUser.newConversation);
            // populateUser.newConversation.forEach((e,i) =>{
            //     let index = user.chatList.findIndex(chat => String(chat._id) === String(e._id))
            //     if(index > -1){
            //         if(user.chatList[index].newMessage > 0){
            //             populateUser.newConversation[i].newMessage = e.newMessage + user.chatList[index].newMessage
            //         }
            //         user.chatList.splice(index,1)
            //     }
            // })
// console.log(populateUser.newConversation,user.chatList);
    //         let newChatlist = populateUser.newConversation.concat(user.chatList)
    //  user.chatList = newChatlist
    //  user.offlineTime = undefined
    //  await user.save()
    //         res.json(newChatlist)
    //     }else{
    //         res.json(userOffline.chatList)
    //     }
    //     }else{
    //         res.json(userOffline.chatList)
    //     }

    //  *****   
        
        


      
      
    //    let newConversationList = []
       
    //    if(user.chatListId.length !== 0){
    //     list.forEach(e =>{
    //     if(!user.chatListId.some(ele => String(ele) === e)) newConversationList.push(e)
        
    //    })
    // }else{console.log("elseee");
    //     newConversationList = list
    // }
    //    console.log(newConversationList);
    //    if(newConversationList.length > 0){
    //    let newChatlist = newConversationList.concat(user.chatListId)
    //    user.chatListId = newChatlist
    //    user.newConversation = newConversationList
    //   await user.save()
       
    //    let populateUser = await users.findById(req.params.userId).populate("newConversation",["name","profilePicture"])
       
    //     newConversationList.forEach(e =>{
    //         let index = populateUser.newConversation.findIndex(chat => String(chat._id) === e)
    //         // console.log("comes here",index);
    //         populateUser.newConversation[index].newMessage = true
    //     })
    //     // console.log(populateUser.newConversation);
    //     // console.log(user.chatList);
    //     // console.log(populateUser.newConversation.concat(user.chatList));
    //     user.chatList = populateUser.newConversation.concat(user.chatList)
    //     // console.log(user.chatList);
    //     await user.save()
    //     let finalChatlist = await users.findById(req.params.userId)
    //     res.json(finalChatlist.chatList)
    //    }else{
    //     res.json(user.chatList)
    //    }
     
    } catch (error) {console.log(error)
        res.status(500).json({message:"Something went wrong,Please try again"})
    }
})

app.get("/getMessages",async(req,res) => {
    try {
        if(req.query.user === req.query.friend){
            let messages = await conversations.find({members:[req.query.user,req.query.friend]},{message:1,sender:1,createdAt:1,status:1})
            res.json(messages)
        }else{
            let messages = await conversations.find({members:{$all:[req.query.user,req.query.friend]}},{message:1,sender:1,createdAt:1,status:1})
            res.json(messages)
        }
        
    } catch (error) {
        res.status(500).json({message:"Something went wrong,Please try again"})
    }
})

app.put("/orderChatlist",async(req,res) =>{console.log(req.body);
    try {
        let user = await users.findById(req.body.userId)
        let index = user.chatList.findIndex(e => String(e._id) === req.body.chat._id)
        console.log(index);
        if(index === -1){
        user.chatList.unshift(req.body.chat)
        }else{
            user.chatList.splice(index,1)
            user.chatList.unshift(req.body.chat)
        }

        await user.save()
        res.json({message:"Chatlist ordered successfullly"})
    } catch (error) {
        res.status(500).json({message:"Something went wrong,Please try again"})
    }
})

app.put("/clearNotification",async(req,res) =>{ console.log(req.body)
    try {
        req.body.forEach(async(e) =>{
            let conversation = await conversations.findById(e)
            conversation.status = "Seen"
            await conversation.save()

        })
        res.json({message:"Notification cleared successfully"})
    } catch (error) {
        res.status(500).json({message:"Something went wrong,Please try again"})
    }
})

app.put("/createOfflineTime",async(req,res) =>{ console.log("offline");console.log(req.body);
    try {
        let user = await users.findById(req.body.userId)
        user.offlineTime = req.body.time
        
        await user.save()
    } catch (error) {console.log(error);
        res.status(500).json({message:"Something went wrong,Please try again"})
    }
})

app.get("/chatMember/:sender",async(req,res) =>{
    try {
        let user = await users.findById(req.params.sender)
        let {name,profilePicture,_id} = user
        let userDetails ={
            name,profilePicture,_id,
            newMessage : 1,
            updatedAt: Date.now()
        }
        res.json(userDetails)
    } catch (error) {
        res.status(500).json({message:"Something went wrong,Please try again"})
    }
})

app.listen(process.env.PORT || 3001)