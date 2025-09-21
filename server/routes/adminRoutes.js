const express = require("express");
const router = express.Router();
const { getPendingUsers, approveUser } = require("../controllers/adminController");

router.get("/pending-users", getPendingUsers);
router.post("/approve-user", approveUser);

module.exports = router;
