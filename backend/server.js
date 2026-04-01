require("dotenv").config();
const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const path = require("path");

const productRoutes = require("./routes/productRoutes");
const notificationRoutes = require("./routes/notificationRoutes");

const app = express();

app.use(cors());
app.use(express.json());

// Serve the frontend static files (dashboard.html, dashboard.js, sw.js, etc.)
app.use(express.static(path.join(__dirname, '..')));

mongoose.connect(process.env.MONGO_URI || "mongodb://127.0.0.1:27017/expiryTracker")
    .then(() => {
        console.log("MongoDB Connected");
        // Start the daily expiry scheduler after DB is ready
        require("./utils/scheduler");
    })
    .catch(err => console.log(err));

app.use("/api/products", productRoutes);
app.use("/api/notifications", notificationRoutes);

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
    console.log(`Dashboard available at: http://localhost:${PORT}/dashboard.html`);
});
