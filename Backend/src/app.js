import dotenv from "dotenv";
dotenv.config();
import express from "express";
import {createServer} from "node:http";

import mongoose from "mongoose";
import { connectToSocket } from "./controllers/socketManager.js";

import cors from "cors";
import userRoutes from "./routes/users.route.js";

const app = express();
const server = createServer(app);
connectToSocket(server);

app.set("port",(process.env.PORT || 8000))
app.use(cors());
app.use(express.json({limit: "40kb"}));
app.use(express.urlencoded({limit: "40kb",extended: true }));

app.use("/api/v1/users", userRoutes);


const start = async()=>{
    server.listen(app.get("port"), () => {
        console.log(`Server running on port ${app.get("port")}`);
    });

    if (process.env.MONGO_URI) {
        try {
            const connectionDB = await mongoose.connect(process.env.MONGO_URI);
            console.log(`MONGO Connected DB Host: ${connectionDB.connection.host}`)
        } catch (error) {
            if (error.code === "ENOTFOUND" && error.syscall === "querySrv") {
                console.error("MongoDB connection failed: the Atlas SRV hostname could not be resolved.");
                console.error("Video calls can still use Socket.IO, but login/history need a working Backend/.env MONGO_URI.");
                console.error("Copy a fresh connection string from MongoDB Atlas, or check your DNS/network connection.");
            } else {
                console.error("MongoDB connection failed:", error.message);
            }
        }
    } else {
        console.error("MONGO_URI is missing. Video calls can still use Socket.IO, but login/history need Backend/.env.");
    }
}

start();
