import httpStatus from "http-status";
import { User } from "../models/user.model.js";
import bcrypt from "bcrypt"


import crypto from "crypto"
import { Meeting } from "../models/meeting.model.js";
const login = async (req, res) => {

    const { username, password } = req.body;

    if (!username || !password) {
        return res.status(400).json({ message: "Please Provide" })
    }

    try {
        const user = await User.findOne({ username });
        if (!user) {
            return res.status(httpStatus.NOT_FOUND).json({ message: "User Not Found" })
        }


        let isPasswordCorrect = await bcrypt.compare(password, user.password)

        if (isPasswordCorrect) {
            let token = crypto.randomBytes(20).toString("hex");

            user.token = token;
            await user.save();
            return res.status(httpStatus.OK).json({
                token: token,
                user: {
                    name: user.name,
                    username: user.username
                }
            })
        } else {
            return res.status(httpStatus.UNAUTHORIZED).json({ message: "Invalid Username or password" })
        }

    } catch (e) {
        return res.status(500).json({ message: `Something went wrong ${e}` })
    }
}

const register = async (req, res) => {
    console.log("REGISTER HIT");
    console.log(req.body);  
    

    try {
        const { name, username, password } = req.body;

        if (!name || !username || !password) {
            return res.status(400).json({ message: "All fields are required" });
        }
        
        const existingUser = await User.findOne({ username });
        if (existingUser) {
            return res.status(httpStatus.CONFLICT).json({ message: "User already exists" });
        }

        const hashedPassword = await bcrypt.hash(password, 10);

        const newUser = new User({
            name: name,
            username: username,
            password: hashedPassword
        });

        await newUser.save();

        res.status(httpStatus.CREATED).json({ message: "User Registered" })

    } catch (e) {
        res.json({ message: `Something went wrong ${e}` })
    }

}


const getUserHistory = async (req, res) => {
    const { token } = req.query;

    if (!token) {
        return res.status(400).json({ message: "Token required" });
    }

    try {
        const user = await User.findOne({ token });

        if (!user) {
            return res.status(401).json({ message: "Invalid token" });
        }

        const meetings = await Meeting.find({ user_id: user.username });

        return res.status(200).json(meetings);

    } catch (e) {
        return res.status(500).json({ message: "Server error" });
    }
};


const addToHistory = async (req, res) => {
    const { token, meeting_code } = req.body;

    if (!token || !meeting_code) {
        return res.status(400).json({ message: "Missing fields" });
    }

    try {
        const user = await User.findOne({ token });

        if (!user) {
            return res.status(401).json({ message: "Invalid token" });
        }

        const newMeeting = new Meeting({
            user_id: user.username,
            meetingCode: meeting_code
        });

        await newMeeting.save();

        return res.status(201).json({ message: "Added code to history" });

    } catch (e) {
        return res.status(500).json({ message: "Server error" });
    }
};



export { login, register, getUserHistory, addToHistory }
