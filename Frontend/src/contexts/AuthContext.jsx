/* eslint-disable react-refresh/only-export-components */
import axios from "axios";
import httpStatus from "http-status";
import { createContext, useContext, useState } from "react";
import { useNavigate } from "react-router-dom";
import server from "../environment";


export const AuthContext = createContext({});

const client = axios.create({
    baseURL: `${server}/api/v1/users`
})


export const AuthProvider = ({ children }) => {

    const authContext = useContext(AuthContext);


    const storedUser = localStorage.getItem("user");
    const [userData, setUserData] = useState(storedUser ? JSON.parse(storedUser) : authContext);


    const router = useNavigate();

    const handleRegister = async (name, username, password) => {
        let request = await client.post("/register", {
            name: name,
            username: username,
            password: password
        })


        if (request.status === httpStatus.CREATED) {
            return request.data.message;
        }
    }

    const handleLogin = async (username, password) => {
        let request = await client.post("/login", {
            username: username,
            password: password
        });

        console.log(username, password)
        console.log(request.data)

        if (request.status === httpStatus.OK) {
            localStorage.setItem("token", request.data.token);
            localStorage.setItem("user", JSON.stringify(request.data.user));
            setUserData(request.data.user);
            router("/home")
        }
    }

    const getHistoryOfUser = async () => {
        let request = await client.get("/get_all_activity", {
            params: {
                token: localStorage.getItem("token")
            }
        });
        return request.data
    }

    const addToUserHistory = async (meetingCode) => {
        let request = await client.post("/add_to_activity", {
            token: localStorage.getItem("token"),
            meeting_code: meetingCode
        });
        return request
    }


    const data = {
        userData, setUserData, addToUserHistory, getHistoryOfUser, handleRegister, handleLogin
    }

    return (
        <AuthContext.Provider value={data}>
            {children}
        </AuthContext.Provider>
    )

}
