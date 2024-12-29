const mongoose = require('mongoose');

const profileSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User', // Reference to the User model
    required: true,
    unique: true, // Enforce uniqueness of the userId
  },
  email: {
    type: String,
    required: true, // Ensure the email is required
  },
  name: { type: String },
  age: { type: Number },
  phone: { type: String},
  address: { type: String},
  jobExperience: { type: String},
  annualIncome: { type: Number},
  loanAmount: { type: Number},
  creditScore: { type: Number },
  loanStatus: { type: String},
}, { timestamps: true });

const Profile = mongoose.model('Profile', profileSchema);

module.exports = Profile;
