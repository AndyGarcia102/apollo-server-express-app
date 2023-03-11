const {model, Schema, mongoose} = require('mongoose');

const groupSchema = new Schema({
    coordinatorId: mongoose.ObjectId,
    groupName: {type:String, require:true, unique: true},
    projectField: {type:String, require:true}, // maybe turn this into an ENUM??
    groupNumber: {type: Number, require: true, unique: true},
    memberCount:{type: Number}
})

module.exports = model("Group",groupSchema);