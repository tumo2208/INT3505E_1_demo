import express from "express";
import bodyParser from "body-parser";
import dotenv from "dotenv";
import authRoutes from "./AuthRoute.js";
import { authenticateToken } from "./middleware.js";
import "./redisClient.js";

dotenv.config();
const app = express();
app.use(bodyParser.json());

app.use("/auth", authRoutes);

app.get("/user/profile", authenticateToken, (req, res) => {
    console.log(req.user);
    res.json({ message: "Welcome!", user: req.user });

});

app.listen(process.env.PORT, () => {
    console.log(`Server running at http://localhost:${process.env.PORT}`);
});

export default app;
