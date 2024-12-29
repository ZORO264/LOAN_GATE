const express = require("express");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const { OAuth2Client } = require("google-auth-library");
const User = require("../models/userModel");
const Profile = require("../models/Profile");
const router = express.Router();

const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID); // Initialize Google OAuth client

// Signup Route
router.post("/signup", async (req, res) => {
  const { name, email, password } = req.body;

  try {
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ message: "User already exists" });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const newUser = new User({ name, email, password: hashedPassword });
    await newUser.save();

    res.status(201).json({ message: "User registered successfully" });
  } catch (error) {
    console.error("Signup Error:", error);
    res.status(500).json({ message: "Internal Server Error" });
  }
});

router.get('/profile', async (req, res) => {
  const { email } = req.query; // Assuming email is passed as a query parameter

  try {
    // Check if the user exists in the User collection
    const user = await User.findOne({ email });

    if (!user) {
      return res.status(404).json({ message: 'User not found. Please sign up first.' });
    }

    // Check if a profile exists for this user
    const profile = await Profile.findOne({ email });

    if (!profile) {
      return res.status(404).json({ message: 'Profile not found. Redirect to create-profile.' });
    }

    // Return the profile data
    return res.status(200).json({ profile });
  } catch (error) {
    console.error('Error fetching profile:', error);
    return res.status(500).json({ message: 'An error occurred while fetching the profile.' });
  }
});


router.post('/create-profile', async (req, res) => {
  const { email, name, age, phone, address, jobExperience, annualIncome, loanAmount, creditScore, loanStatus } = req.body;

  try {
    // Check if the user exists by email
    const user = await User.findOne({ email });

    if (!user) {
      return res.status(404).json({ message: 'User not found. Please sign up first.' });
    }

    // Check if the profile already exists
    const existingProfile = await Profile.findOne({ email });

    if (existingProfile) {
      return res.status(400).json({ message: 'Profile already exists for this user.' });
    }

    // Create and save a new profile
    const newProfile = new Profile({
      email: user.email, // Use email from the User collection
      name,
      age,
      phone,
      address,
      jobExperience,
      annualIncome,
      loanAmount,
      creditScore,
      loanStatus,
    });

    await newProfile.save();

    return res.status(201).json({ message: 'Profile created successfully!' });
  } catch (error) {
    console.error('Error creating profile:', error);
    return res.status(500).json({ message: 'An error occurred while creating the profile.' });
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

    const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, { expiresIn: "1h" });

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
    const jwtToken = jwt.sign({ id: user._id }, process.env.JWT_SECRET, { expiresIn: "1h" });

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

module.exports = router;
