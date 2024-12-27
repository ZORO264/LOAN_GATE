const express = require("express");
const router = express.Router();

router.post("/eligibility", (req, res) => {
    const { loanAmount, creditScore, annualIncome, monthlyDebts, yearsInJob, houseOwned, loanPurpose, numberOfOtherLoans, bankruptcy, loanTenure } = req.body;
  
    // Simple eligibility logic (this is just an example, replace with your own logic)
    let maxLoanAmount = 0;
    let loanTerms = "Not eligible";
  
    // Example rules:
    if (creditScore >= 600 && annualIncome >= 20000 && yearsInJob >= 2 && loanTenure <= 30 && numberOfOtherLoans <= 2 && !bankruptcy) {
      maxLoanAmount = loanAmount;  // User can borrow up to the requested loan amount
      loanTerms = loanTenure >= 5 ? `${loanTenure} years` : "Not eligible for this loan tenure";
    }
  
    res.json({
      maxLoanAmount,
      loanTerms,
    });
  });
  

  module.exports = router