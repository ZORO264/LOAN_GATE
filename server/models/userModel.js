const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: function() { return !this.isGoogleSignup; }, default: null },  // Optional for Google signup
  isGoogleSignup: { type: Boolean, default: false }, // A flag to check if the user signed up via Google
});

const User = mongoose.model('User', userSchema);

module.exports = User;
