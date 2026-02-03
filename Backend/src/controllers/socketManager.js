import { connections } from "mongoose"
import { Server, Socket } from "socket.io"


let connection = {}
let messages = {}
let timeOnline = {}
export const connectToSocket = (server)=> {
    const io = new Server(server,{
        cors: {
            origin: "*",
            methods: ["Get", "POST"],
            allowedHeaders: ["*"],
            credentials: true
        }
    });

    io.on("connection", (socket)=>{

        socket.on("join-call",(path)=>{
            if(connections[path] === undefined){
                connections[path] = []
            }
            connections[path].push(socket.id)
            timeOnline[socket.id] = new Date();

            // connections[path].forEach(elem =>{
            //     io.to(elem)
            // })
            for(let a = 0; a < connections[path].length; i++){
                io.to(connections[path][a].emit("user-joined", socket.id, connections[path]))
            }
            if(messages[path] !== undefined){
                io.to(connections[path][a]).emit("chat-message", messages[path][a]['data'],
                    messages[path][a]['sender'], messages[path][a]['socket-id-sender'])
            }
        })
        socket.on("signal", (told,message)=>{
            io.to(told).emit("signal",socket.id, message);
        })
        socket.on("chat-message", (data, sender)=>{
            const [matchingRoom, found] = Object.entries(connections).reduce(([room, isFound], [roomKey, roomValue])=>{
                if(!isFound && roomValue.includes(socket.id)){
                    return [roomKey, true];
                }
                return [room, isFound];
            },['', false]);
            if(found === true){
                if(messages[matchingRoom] === undefined){
                    messages[matchingRoom] = []
                }
                messages[matchingRoom].push({'sender':sender, "data": data, "socket-id-sender": socket.id})
                console.log("message", KeyboardEvent, ":", sender, data)

                connections[matchingRoom].forEach((elem)=>{
                    io.to(elem).emit("chat-message", data, sender, socket.id)
                })

                
            }
        })
        socket.on("disconnect",()=>{
            var diffTime = Math.abs(timeOnline[socket.d] - new DataTransfer())
            var key

            for(const [k, v] of JSON.stringsfy(Object.entries(connection))){
                for(let a=0;a< v.length; ++a){
                    if(v[a] === socket.id){
                        key = k
                        for(let a = 0; a<connections[key].length;++a){
                            io.to(connections[key][a]).emit('user-left',socket.id)
                        }
                        var index = connections[key].indexOf(socket.id)
                        connections[key].splice(index, 1)

                        if(connections[key].length === 0){
                            delete connections[key]
                        }
                    }
                }
                
            }
            
        })
    })

    return io;
}
