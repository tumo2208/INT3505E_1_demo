const express = require("express");
const router = express.Router();
const User = require("../models/User");

router.get("/", async (req, res) => {
    try {
        const users = await User.find();
        if (users.length === 0) {
            return res.status(404).json({ message: "No users found" });
        }
        res.status(200).json(users);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

router.post("/", async (req, res) => {
    const { name, email, age } = req.body;

    const user = new User({
        name: name,
        email: email,
        age: age,
    });

    try {
        await user.save();
        res.status(201).json({message: "User registered successfully"});
    } catch (err) {
        res.status(400).json({ message: err.message });
    }
});

router.put("/:id", async (req, res) => {
    try {
        await User.findByIdAndUpdate(
            req.params.id,
            req.body,
            { new: true }
        );
        res.status(200).json({message: `User with id ${req.params.id} updated successfully`});
    } catch (err) {
        res.status(400).json({ message: err.message });
    }
});

router.delete("/:id", async (req, res) => {
    try {
        await User.findByIdAndDelete(req.params.id);
        res.status(200).json({message: `User with id ${req.params.id} deleted successfully`});
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

module.exports = router;
