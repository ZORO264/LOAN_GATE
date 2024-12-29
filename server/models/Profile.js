const mongoose = require('mongoose');

const profileSchema = new mongoose.Schema({
  email: { type: String, required: true, unique: true },
  name: String,
  age: Number,
  phone: String,
  address: String,
  jobExperience: String,
  annualIncome: Number,
  loanAmount: Number,
  creditScore: Number,
  loanStatus: String
});

module.exports = mongoose.model('Profile', profileSchema);
