const express = require("express");
const mongoose = require("mongoose");
const dotenv = require("dotenv");
const cors=require("cors");

dotenv.config();
const app = express();
app.use(express.json());
app.use(cors(
    allowedOrigins=['http://localhost:5173']
));
// Routes
app.use("/api/auth", require("./routes/authRoutes"));
app.use("/api/admin", require("./routes/adminRoutes"));

// Connect MongoDB
mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log("MongoDB connected"))
  .catch((err) => console.error(err));

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
