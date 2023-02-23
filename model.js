const mongoose = require("mongoose")

const timestamp = new Date()
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
    chatList : [{
        type : mongoose.SchemaTypes.ObjectId,
        ref : "users"
        }],
    temporary : String,
    profilePicture:String
},{timestamps:true})

let users = mongoose.model("users",userSchema)

const conversationSchema = new mongoose.Schema({
    members : [mongoose.SchemaTypes.ObjectId],
    sender : mongoose.SchemaTypes.ObjectId,
    message : String
},{timestamps:true})

let conversations = mongoose.model("conversations",conversationSchema)

module.exports = {
    users,
    conversations
}