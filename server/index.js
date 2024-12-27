const express = require('express');
const mongoose = require('mongoose');
const dotenv = require('dotenv');
const cors = require('cors');
const loanRoutes = require("./routes/loanRoutes");

dotenv.config();

const app = express();

app.use(cors());
app.use(express.json());
app.use("/api/loan", loanRoutes);

mongoose.connect(process.env.MONGO_URI,{
    useNewUrlParser: true,
    useUnifiedTopology: true,
}).then(()=>{
    console.log("Connected to MongoDB");
}).catch(err=>{
    console.log("MongoDB connection error:",err);
});

app.get("/",(req,res)=>{
    res.send("Welcome to Loan Gate Backend!");
})

const PORT = process.env.PORT || 5000;
app.listen(PORT,()=>{
    console.log(`Server running on port ${PORT}`);
});

