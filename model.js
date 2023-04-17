const mongoose = require("mongoose")

const userSchema = new mongoose.Schema({
    name : {
        type:String,
        required:true
    },
    email : {
        type:String,
        required:true
    },
    password : {
        type:String,
        required:true
    },
    chatListId:[mongoose.SchemaTypes.ObjectId],
    newConversation : [{
        type : mongoose.SchemaTypes.ObjectId,
        ref : "users"
    }],
    chatList:[{
        _id:mongoose.SchemaTypes.ObjectId,
        name:String,
        profilePicture:String,
        newMessage:Number,
        
    }],
    temporary : String,
    profilePicture:String,
    newMessage:Number,
    offlineTime:Number,
    updatedAt:Number,
    
},{timestamps:true})

let users = mongoose.model("users",userSchema)

const conversationSchema = new mongoose.Schema({
    members : [mongoose.SchemaTypes.ObjectId],
    sender : mongoose.SchemaTypes.ObjectId,
    message : String,
    status : {
        type : String,
        default : "Delivered"
    }
},{timestamps:true})

let conversations = mongoose.model("conversations",conversationSchema)

module.exports = {
    users,
    conversations
}