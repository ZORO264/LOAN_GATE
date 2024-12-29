const express = require("express");
const mongoose = require("mongoose");
const dotenv = require("dotenv");
const cors = require("cors");
const loanRoutes = require("./routes/loanRoutes");
const userRoutes = require("./routes/userRoutes"); // Import user routes

dotenv.config();

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// Routes
app.use("/api/loan", loanRoutes);
app.use("/api/user", userRoutes); // Use user routes

// MongoDB Connection
const connectToDatabase = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI || "mongodb://localhost:27017/loangateDB", {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    console.log("Connected to MongoDB");
  } catch (err) {
    console.error("MongoDB connection error:", err.message);
    setTimeout(connectToDatabase, 5000);
  }
};
connectToDatabase();

// Root Route
app.get("/", (req, res) => {
  res.status(200).send("Welcome to Loan Gate Backend!");
});

// Error Handling Middleware for Uncaught Routes
app.use((req, res, next) => {
  res.status(404).json({ message: "Route not found" });
});

// Global Error Handler
app.use((err, req, res, next) => {
  console.error("An error occurred:", err.message);
  res.status(500).json({ message: "Internal Server Error" });
});

// Validate Required Environment Variables
const validateEnv = () => {
  const requiredVars = ["MONGO_URI", "PORT", "JWT_SECRET"];
  requiredVars.forEach((variable) => {
    if (!process.env[variable]) {
      console.error(`Environment variable ${variable} is not set`);
      process.exit(1);
    }
  });
};
validateEnv();

// Start Server
const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
