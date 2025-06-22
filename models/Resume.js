const mongoose = require('mongoose');

// const ProjectSchema = new mongoose.Schema({
//   name: String,
//   description: String
// });


const ResumeSchema = new mongoose.Schema({
  name: String,
  email: String,
  phone: String,
  linkedIn: String,
  skills: [String],
  workExperience:[Object],
  experience: Number,
  projects:[Object],
  profession:String,
  uploadedAt: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model('Resume', ResumeSchema);
