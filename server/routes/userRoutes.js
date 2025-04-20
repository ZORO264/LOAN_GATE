const express = require("express");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const { OAuth2Client } = require("google-auth-library");
const User = require("../models/userModel");
const Profile = require("../models/Profile");
const router = express.Router();
const Loan = require('../models/loan');

const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID); // Initialize Google OAuth client


const mongoose = require('mongoose');

// Loan Form Schema
const loanFormSchema = new mongoose.Schema({
  loan_application_id: String, // Common ID to link with loan documents
  email: String,
  loanAmount: Number,
  creditScore: Number,
  annualIncome: Number,
  monthlyDebts: Number,
  houseStatus: String,
  yearsInJob: Number,
  status: String,
  createdAt: Date,
  updatedAt: Date,
});

const LoanForm = mongoose.model('loan_forms', loanFormSchema);

// Loan Documents Schema
const loanDocumentsSchema = new mongoose.Schema({
  loan_application_id: String, // Common ID to link with loan form
  aadharCard: String,
  idCard: String,
  addressProof: String,
  bankStatements: String,
  documentsSubmittedAt: Date,
  email: String,
});

const LoanDocuments = mongoose.model('loan_docs', loanDocumentsSchema);




router.get('/loans', async (req, res) => {
  const email = req.query.email; // User email from query parameter
  try {
    if (!email) {
      return res.status(400).json({ error: 'Email is required' });
    }

    // Fetch all loan forms for the given email
    const loanForms = await LoanForm.find({ email });

    // Fetch and combine loan documents for each loan form
    const loans = await Promise.all(
      loanForms.map(async (loanForm) => {
        const loanDocs = await LoanDocuments.findOne({ loan_application_id: loanForm.loan_application_id });

        return {
          loanForm: {
            loanAmount: loanForm.loanAmount,
            creditScore: loanForm.creditScore,
            annualIncome: loanForm.annualIncome,
            monthlyDebts: loanForm.monthlyDebts,
            houseStatus: loanForm.houseStatus,
            yearsInJob: loanForm.yearsInJob,
            status: loanForm.status,
            createdAt: loanForm.createdAt,
            updatedAt: loanForm.updatedAt,
          },
          loanDocuments: loanDocs ? {
            aadharCard: loanDocs.aadharCard,
            idCard: loanDocs.idCard,
            addressProof: loanDocs.addressProof,
            bankStatements: loanDocs.bankStatements,
            documentsSubmittedAt: loanDocs.documentsSubmittedAt,
          } : null,
        };
      })
    );

    res.status(200).json(loans);
  } catch (error) {
    console.error('Error fetching loans:', error);
    res.status(500).json({ error: 'Failed to fetch loan applications' });
  }
});



// Middleware for verifying JWT token
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers["authorization"];
  const token = authHeader && authHeader.split(" ")[1];
  if (!token) return res.status(401).json({ message: "Access token missing" });

  jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
    if (err) return res.status(403).json({ message: "Invalid token" });
    req.user = user; // Attach user info from token
    next();
  });
};

const verifyToken = (req, res, next) => {
  const token = req.headers["authorization"]?.split(" ")[1];
  if (!token) return res.status(403).json({ message: "No token provided." });

  jwt.verify(token, process.env.JWT_SECRET, (err, decoded) => {
    if (err) return res.status(403).json({ message: "Invalid token." });
    req.userId = decoded.id;
    next();
  });
};


router.post("/google-signup", async (req, res) => {
  const { token } = req.body; // The token received from Google OAuth

  try {
    // Verify the Google token
    const ticket = await client.verifyIdToken({
      idToken: token,
      audience: "982269815807-ln5agt844sv84kavhi8fc7e3thm0i4ls.apps.googleusercontent.com", // Replace with your Google client ID
    });
    const { email, name } = ticket.getPayload(); // Extract email and name from the Google payload

    // Check if the user already exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ message: "User already exists" });
    }

    // Create the new user with the isGoogleSignup flag set to true
    const newUser = new User({
      name,
      email,
      password: "",  // Empty password for Google users
      isGoogleSignup: true,  // Mark as Google signup
    });
    await newUser.save();

    // Create an empty profile for the new user
    const newProfile = new Profile({
      userId: newUser._id,  // Link profile to the new user
      email: newUser.email,
      name: "",  // Empty name initially
      age: null, // Null by default
      phone: "", // Empty by default
      address: "", // Empty by default
      jobExperience: "", // Empty by default
      annualIncome: null, // Null by default
      loanAmount: null, // Null by default
      creditScore: null, // Null by default
      loanStatus: "Pending", // Default loan status
    });
    await newProfile.save();

    res.status(201).json({ message: "User signed up and profile created successfully" });
  } catch (error) {
    console.error("Google Signup Error:", error);
    res.status(500).json({ message: "Internal Server Error" });
  }
});
// Signup Route
router.post("/signup", async (req, res) => {
  const { name, email, password } = req.body;

  try {
    // Check if the user already exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ message: "User already exists" });
    }

    // Hash the password before saving
    const hashedPassword = await bcrypt.hash(password, 10);

    // Step 1: Create the new user
    const newUser = new User({
      name,
      email,
      password: hashedPassword,
    });
    await newUser.save();

    // Step 2: Create an empty profile linked to the new user
    const newProfile = new Profile({
      userId: newUser._id,  // Linking the profile to the newly created user
      email: newUser.email,
      name: "", // Empty name initially, this can be updated later
      age: null, // You can set defaults or leave as null
      phone: "", // Empty phone number initially
      address: "", // Empty address initially
      jobExperience: "", // Empty job experience
      annualIncome: null, // Null until the user fills it out
      loanAmount: null, // Null until the user provides it
      creditScore: null, // Null initially
      loanStatus: "Pending", // Default loan status
    });
    await newProfile.save();

    res.status(201).json({ message: "User registered and profile created successfully" });
  } catch (error) {
    console.error("Signup Error:", error);
    res.status(500).json({ message: "Internal Server Error" });
  }
});

// Login Route
router.post("/login", async (req, res) => {
  const { email, password } = req.body;

  try {
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      return res.status(400).json({ message: "Invalid credentials" });
    }

    const token = jwt.sign({ id: user._id, email: user.email }, process.env.JWT_SECRET, { expiresIn: "1h" });

    res.status(200).json({
      message: "Login successful",
      user: { name: user.name, email: user.email },
      token,
    });
  } catch (error) {
    console.error("Login Error:", error);
    res.status(500).json({ message: "Internal Server Error" });
  }
});

// Google Login/Sign-Up Route
router.post("/google-login", async (req, res) => {
  const { token } = req.body;

  try {
    // Verify Google token
    const ticket = await client.verifyIdToken({
      idToken: token,
      audience: process.env.GOOGLE_CLIENT_ID,
    });

    const payload = ticket.getPayload();
    const { email, name, sub: googleId } = payload; // `sub` is Google's unique user ID

    let user = await User.findOne({ email });

    if (!user) {
      // Create a new user if they don't exist
      const hashedPassword = await bcrypt.hash(googleId, 10); // Use Google's unique ID as the password
      user = new User({ name, email, password: hashedPassword });
      await user.save();
    }

    // Generate JWT token
    const jwtToken = jwt.sign({ id: user._id, email: user.email }, process.env.JWT_SECRET, { expiresIn: "1h" });

    res.status(200).json({
      message: "Google login successful",
      user: { name: user.name, email: user.email },
      token: jwtToken,
    });
  } catch (error) {
    console.error("Google Login Error:", error);
    res.status(500).json({ message: "Google authentication failed" });
  }
});

// Fetch Profile Route
// Get User and Profile Check Route
router.get('/profile', async (req, res) => {
  const { email } = req.query; // Assuming email is passed as a query parameter

  try {
    // Find the user in the User collection
    const user = await User.findOne({email});

    if (!user) {
      return res.status(404).json({ message: 'User not found. Please sign up first.' });
    }

    // Check if the user has profile data
    const profile = await Profile.findOne({email}); // Assuming Profile schema has userId linked to User collection

    // If profile is found, return it, else return message indicating profile not found
    if (profile) {
      return res.status(200).json({ profile: profile });
    } else {
      return res.status(404).json({ message: 'Profile not found. Please create your profile.' });
    }
  } catch (error) {
    console.error('Error fetching profile:', error);
    return res.status(500).json({ message: 'An error occurred while fetching the profile.' });
  }
});

router.get('/email', authenticateToken, (req, res) => {
  try {
    // Access the email from the decoded JWT token
    const email = req.user.email;

    if (!email) {
      return res.status(404).json({ message: 'Email not found.' });
    }

    // Return the email to the client
    res.status(200).json({ email });
  } catch (error) {
    console.error('Error fetching email:', error);
    res.status(500).json({ message: 'An error occurred while fetching the email.' });
  }
});



// Create Profile Route
// Create Profile Route using Email
// Create Profile Route
// PUT /api/user/edit-profile
router.put('/edit-profile', async (req, res) => {
  const { email, ...profileData } = req.body;

  try {
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    const profile = await Profile.findOneAndUpdate(
      { userId: user._id },
      { $set: profileData },
      { new: true, upsert: true } // Upsert to create profile if it doesn't exist
    );

    res.status(200).json({ message: 'Profile updated successfully', profile });
  } catch (error) {
    console.error('Error updating profile:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// POST /api/user/profile
router.post('/profile', async (req, res) => {
  const { email } = req.body;

  try {
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    let profile = await Profile.findOne({ email });
    if (!profile) {
      profile = new Profile({email}); // Create an empty profile
      await profile.save();
    }

    res.status(201).json({ profile });
  } catch (error) {
    console.error('Error creating profile:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

router.put("/update-profile", verifyToken, async (req, res) => {
  const { email, name, phone, address } = req.body;

  // Ensure required fields are provided
  if (!name || !phone || !address) {
    return res.status(400).json({ message: "Please provide all required fields." });
  }

  try {
    // Find user by email (or by userId from the token if preferred)
    const user = await User.findOne({ email });

    if (!user) {
      return res.status(404).json({ message: "User not found." });
    }

    // Update user profile with new data
    user.name = name;
    user.phone = phone;
    user.address = address;

    await user.save(); // Save the updated user profile to the database

    res.status(200).json({ message: "Profile updated successfully." });
  } catch (error) {
    console.error("Error updating profile:", error);
    res.status(500).json({ message: "Server error. Could not update profile." });
  }
});





module.exports = router;
