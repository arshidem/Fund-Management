const mongoose = require("mongoose");

const connectDB = async () => {
  const maxRetries = 5; // number of attempts
  let attempts = 0;

  const connect = async () => {
    try {
      await mongoose.connect(process.env.MONGO_URI);
      console.log("✅ MongoDB connected");
    } catch (error) {
      attempts++;
      console.error(`❌ MongoDB connection error (Attempt ${attempts}):`, error.message);

      if (attempts < maxRetries) {
        console.log("🔁 Retrying in 5 seconds...");
        setTimeout(connect, 5000);
      } else {
        console.error("💥 Could not connect to MongoDB after multiple attempts");
        process.exit(1);
      }
    }
  };

  connect();
};

module.exports = connectDB;
