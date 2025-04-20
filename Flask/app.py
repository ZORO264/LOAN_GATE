from flask import Flask, request, jsonify
import torch
import torch.nn as nn
from flask_pymongo import PyMongo
from bson import ObjectId
from datetime import datetime
from tab_transformer_pytorch import TabTransformer
import pytesseract
import cv2
import google.generativeai as genai
import os
from pymongo import MongoClient
from flask_cors import CORS
import requests
app = Flask(__name__)
CORS(app)
genai.configure(api_key="AIzaSyAL1FxSlsiaGbMz5I3i7J5_vsIsfuJSKak")

# Device configuration (use GPU if available)
device = torch.device("cuda" if torch.cuda.is_available() else "cpu")

# Load pre-trained model
model = TabTransformer(
    categories=[4],  # Update according to your categorical features
    num_continuous=5,  # Number of continuous features
    dim=16,            # Embedding dimension
    dim_out=1,         # Output dimension (binary classification)
    depth=2,           # Number of transformer layers
    heads=2,           # Number of attention heads
    attn_dropout=0.2,  # Attention dropout rate
    ff_dropout=0.1,    # Feed-forward dropout rate
    mlp_hidden_mults=(2, 1),  # MLP hidden layer dimensions
    mlp_act=nn.ReLU(),  # MLP activation function
    continuous_mean_std=None  # Optional: Mean and std for continuous features
).to(device)

# Load pre-trained weights
model.load_state_dict(torch.load(r"c:\Users\ramab\Downloads\tab_transformer.pth", map_location=device))
model.eval()  # Set model to evaluation mode

@app.route('/check-loan-eligibility', methods=['POST'])
def check_loan_eligibility():
    data = request.get_json()

    # Extract data from the request
    home_ownership = data['home_ownership']
    loan_amount = data['loan_amount']
    credit_score = data['credit_score']
    annual_income = data['annual_income']
    monthly_debt = data['monthly_debt']
    years_in_job_numeric = data['years_in_job_numeric']

    # Map categorical feature
    home_ownership_mapping = {'Own Home': 2, 'Home Mortgage': 1, 'Rent': 0}
    custom_home_ownership = home_ownership_mapping[home_ownership]

    # Prepare inputs
    custom_numerical_features = [loan_amount, credit_score, annual_income, monthly_debt, years_in_job_numeric]
    custom_cat_tensor = torch.tensor([custom_home_ownership], dtype=torch.long).unsqueeze(0).to(device)
    custom_cont_tensor = torch.tensor([custom_numerical_features], dtype=torch.float32).to(device)

    # Perform prediction
    with torch.no_grad():
        output = model(custom_cat_tensor, custom_cont_tensor)
        probability = torch.sigmoid(output.squeeze())
        prediction = (probability > 0.5).int()

    # Return prediction and probability
    return jsonify({
        'probability': probability.item(),
        'prediction': 'Yes' if prediction.item() == 1 else 'No'
    })


# MongoDB setup
# client = MongoClient("mongodb://localhost:27017/loangateDB?directConnection=true")
# db = client["document_submission"]
# collection = db["loans"]

app.config["MONGO_URI"] = "mongodb://localhost:27017/loangateDB"
mongo = PyMongo(app)

# Access the loans collection
loans_collection = mongo.db.loan_forms
loan_docs = mongo.db.loan_docs

# Path to Tesseract
pytesseract.pytesseract.tesseract_cmd = r'C:\Program Files\Tesseract-OCR\tesseract.exe'

def preprocess_image(image_path):
    image = cv2.imread(image_path)
    gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
    return gray

def extract_text(image_path):
    processed_image = preprocess_image(image_path)
    return pytesseract.image_to_string(processed_image)

def send_to_gemini(extracted_text):
    model = genai.GenerativeModel("gemini-1.5-flash")
    prompt = f"""
    Extract the following key-value pairs from the text below:
    "Aadhaar Number", "Name", "Age", "Gender"
    {extracted_text}
    calculate age and return age without any additional info also and give aadhar number without spaces
    """
    response = model.generate_content(prompt)
    return response.text

@app.route('/process-aadhar', methods=['POST'])
def process_aadhar():
    if 'file' not in request.files:
        return jsonify({"error": "No file uploaded"}), 400
    
    file = request.files['file']
    file_path = os.path.join(r"C:\Users\ramab\OneDrive\Desktop\Aadhar images", file.filename)
    file.save(file_path)
    
    # Extract text from the uploaded Aadhaar card image
    extracted_text = extract_text(file_path)
    
    # Extract key details using Gemini API
    try:
        response_text = send_to_gemini(extracted_text)
        extracted_data = {
            "file_name": file.filename,
            "extracted_text": extracted_text,
            "processed_data": response_text
        }
        
        # Save extracted data to MongoDB
        loans_collection.insert_one(extracted_data)
        
        return jsonify({
            "message": "Aadhaar processed and saved successfully.",
            "extracted_data": response_text
        })
    except Exception as e:
        return jsonify({"error": f"Failed to process Aadhaar card: {str(e)}"}), 500


@app.route('/submit-remaining-documents', methods=['POST'])
def submit_remaining_documents():
    required_files = ['idCard', 'addressProof', 'bankStatements']
    loan_application_id = request.form.get("loan_application_id")
    email = request.form.get("email")
    for file_key in required_files:
        if file_key not in request.files:
            return jsonify({"error": f"Missing {file_key}"}), 400

    saved_files = {}
    for file_key in request.files:
        file = request.files[file_key]
        file_path = os.path.join(r"C:\Users\ramab\OneDrive\Desktop\Aadhar images", file.filename)
        file.save(file_path)
        saved_files[file_key] = file_path
    saved_files["loan_application_id"]= loan_application_id
    saved_files["email"] = email
    

    # Save paths to MongoDB
    loan_docs.insert_one(saved_files)
    return jsonify({"success": True, "message": "Documents submitted successfully."})




@app.route("/api/loans", methods=["POST"])
def create_loan_application():
    """
    Endpoint to create a new loan application.
    """
    try:
        # Get the loan application data from the request body
        data = request.json
        if not data:
            return jsonify({"success": False, "message": "No data provided"}), 400
        
        # Create the loan application with a pending or closed status
        loan_application = {
            "loan_application_id" : data.get("loan_application_id"),
            "email": data.get("email"),
            "loanAmount": data.get("loanAmount"),
            "creditScore": data.get("creditScore"),
            "annualIncome": data.get("annualIncome"),
            "monthlyDebts": data.get("monthlyDebts"),
            "houseStatus": data.get("houseStatus"),
            "yearsInJob": data.get("yearsInJob"),
            "status": data.get("status", "pending"),  # Default to pending
            "createdAt": datetime.utcnow(),
            "updatedAt": datetime.utcnow()
        }

        # Insert the loan application into the database
        result = loans_collection.insert_one(loan_application)
        return jsonify({
            "success": True,
            "message": "Loan application created successfully.",
            "applicationId": str(result.inserted_id)
        }), 201
    except Exception as e:
        print(f"Error creating loan application: {e}")
        return jsonify({"success": False, "message": "Internal server error"}), 500

@app.route("/api/loans/<application_id>", methods=["PATCH"])
def update_loan_application_status(application_id):
    """
    Endpoint to update the status of a loan application.
    """
    try:
        # Get the new status from the request body
        data = request.json
        new_status = data.get("status")
        if not new_status:
            return jsonify({"success": False, "message": "Status is required"}), 400

        # Update the status of the loan application
        result = loans_collection.update_one(
            {"_id": ObjectId(application_id)},
            {"$set": {"status": new_status, "updatedAt": datetime.utcnow()}}
        )

        if result.matched_count == 0:
            return jsonify({"success": False, "message": "Loan application not found"}), 404

        return jsonify({"success": True, "message": "Loan application status updated successfully."})
    except Exception as e:
        print(f"Error updating loan application status: {e}")
        return jsonify({"success": False, "message": "Internal server error"}), 500

@app.route("/api/loans/<application_id>", methods=["GET"])
def get_loan_application(application_id):
    """
    Endpoint to retrieve a specific loan application by ID.
    """
    try:
        loan_application = loans_collection.find_one({"_id": ObjectId(application_id)})
        if not loan_application:
            return jsonify({"success": False, "message": "Loan application not found"}), 404

        # Convert the MongoDB document to JSON
        loan_application["_id"] = str(loan_application["_id"])
        return jsonify({"success": True, "loanApplication": loan_application})
    except Exception as e:
        print(f"Error retrieving loan application: {e}")
        return jsonify({"success": False, "message": "Internal server error"}), 500

if __name__ == '__main__':
    app.run(debug=True)
