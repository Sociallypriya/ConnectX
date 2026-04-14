import { useEffect, useRef, useState } from 'react'
import io from "socket.io-client";
import { Badge, IconButton, TextField } from '@mui/material';
import { Button } from '@mui/material';
import VideocamIcon from '@mui/icons-material/Videocam';
import VideocamOffIcon from '@mui/icons-material/VideocamOff'
import styles from "../styles/videoComponent.module.css";
import CallEndIcon from '@mui/icons-material/CallEnd'
import MicIcon from '@mui/icons-material/Mic'
import MicOffIcon from '@mui/icons-material/MicOff'
import ScreenShareIcon from '@mui/icons-material/ScreenShare';
import StopScreenShareIcon from '@mui/icons-material/StopScreenShare'
import ChatIcon from '@mui/icons-material/Chat'
import server from '../environment';

const server_url = server;

var connections = {};
var pendingIceCandidates = {};
var remoteStreams = {};

const peerConfigConnections = {
    "iceServers": [
        { "urls": "stun:stun.l.google.com:19302" }
    ]
}

const getRoomId = () => window.location.pathname;

function RemoteVideo({ stream, socketId }) {
    const remoteVideoRef = useRef(null);

    useEffect(() => {
        if (remoteVideoRef.current && stream) {
            remoteVideoRef.current.srcObject = stream;
            remoteVideoRef.current.volume = 1;
            remoteVideoRef.current.play().catch((error) => {
                console.warn("Remote video playback was blocked:", error);
            });
        }
    }, [stream]);

    return (
        <div className={styles.remoteVideoTile}>
            <video
                data-socket={socketId}
                ref={remoteVideoRef}
                autoPlay
                playsInline
                onLoadedMetadata={() => {
                    remoteVideoRef.current?.play().catch((error) => {
                        console.warn("Remote video playback was blocked:", error);
                    });
                }}
            >
            </video>
            <span>Guest</span>
        </div>
    )
}

export default function VideoMeetComponent() {

    var socketRef = useRef();
    let socketIdRef = useRef();

    let localVideoref = useRef();

    let [videoAvailable, setVideoAvailable] = useState(true);

    let [audioAvailable, setAudioAvailable] = useState(true);

    let [video, setVideo] = useState(true);

    let [audio, setAudio] = useState(true);

    let [screen, setScreen] = useState();

    let [showModal, setModal] = useState(false);

    let [screenAvailable, setScreenAvailable] = useState();

    let [messages, setMessages] = useState([])

    let [message, setMessage] = useState("");

    let [newMessages, setNewMessages] = useState(0);

    let [askForUsername, setAskForUsername] = useState(true);

    let [username, setUsername] = useState("");

    const videoRef = useRef([])

    let [videos, setVideos] = useState([])

    const upsertRemoteVideo = (socketId, stream) => {
        let videoExists = videoRef.current.find(video => video.socketId === socketId);

        if (videoExists) {
            const updatedVideos = videoRef.current.map(video =>
                video.socketId === socketId ? { ...video, stream } : video
            );
            videoRef.current = updatedVideos;
            return updatedVideos;
        }

        const updatedVideos = [
            ...videoRef.current,
            {
                socketId,
                stream,
                autoplay: true,
                playsinline: true
            }
        ];
        videoRef.current = updatedVideos;
        return updatedVideos;
    }

    const setLocalVideoRef = (videoElement) => {
        localVideoref.current = videoElement;

        if (videoElement && window.localStream) {
            videoElement.srcObject = window.localStream;
            videoElement.play().catch((error) => {
                console.warn("Local video playback was blocked:", error);
            });
        }
    }

    // TODO
    // if(isChrome() === false) {


    // }

    useEffect(() => {
        getPermissions();
    }, []);


    let getDislayMedia = () => {
        if (screen) {
            if (navigator.mediaDevices.getDisplayMedia) {
                navigator.mediaDevices.getDisplayMedia({ video: true, audio: true })
                    .then(getDislayMediaSuccess)
                    .catch((e) => console.log(e))
            }
        }
    }

    const getPermissions = async () => {
        const [videoPermission, audioPermission] = await Promise.allSettled([
            navigator.mediaDevices.getUserMedia({ video: true }),
            navigator.mediaDevices.getUserMedia({ audio: true })
        ]);

        const stream = new MediaStream();
        const videoStream = videoPermission.status === "fulfilled" ? videoPermission.value : null;
        const audioStream = audioPermission.status === "fulfilled" ? audioPermission.value : null;

        videoStream?.getVideoTracks().forEach(track => stream.addTrack(track));
        audioStream?.getAudioTracks().forEach(track => stream.addTrack(track));

        const hasVideo = stream.getVideoTracks().length > 0;
        const hasAudio = stream.getAudioTracks().length > 0;

        setVideoAvailable(hasVideo);
        setAudioAvailable(hasAudio);
        setScreenAvailable(Boolean(navigator.mediaDevices.getDisplayMedia));
        setVideo(hasVideo);
        setAudio(hasAudio);

        if (videoStream && !hasVideo) {
            videoStream.getTracks().forEach(track => track.stop());
        }

        if (audioStream && !hasAudio) {
            audioStream.getTracks().forEach(track => track.stop());
        }

        if (hasVideo || hasAudio) {
            window.localStream = stream;
            if (localVideoref.current) {
                localVideoref.current.srcObject = stream;
            }
        }

        if (!hasVideo) console.log("Video permission denied or no camera found");
        if (!hasAudio) console.log("Audio permission denied or no microphone found");

        return stream;
    };

    let getMedia = () => {
        window.localStream?.getVideoTracks().forEach(track => {
            track.enabled = video && videoAvailable;
        });
        window.localStream?.getAudioTracks().forEach(track => {
            track.enabled = audio && audioAvailable;
        });
        connectToSocketServer();

    }




    const addLocalStreamToPeer = (peerConnection) => {
        if (!window.localStream) return;

        window.localStream.getTracks().forEach(track => {
            const sender = peerConnection.getSenders().find(existingSender => existingSender.track?.kind === track.kind);

            if (sender) {
                sender.replaceTrack(track);
            } else {
                peerConnection.addTrack(track, window.localStream);
            }
        });
    }

    const ensurePeerConnection = (socketListId) => {
        if (socketListId === socketIdRef.current) {
            return null;
        }

        if (connections[socketListId]) {
            return connections[socketListId];
        }

        const peerConnection = new RTCPeerConnection(peerConfigConnections);
        remoteStreams[socketListId] = new MediaStream();

        peerConnection.onicecandidate = function (event) {
            if (event.candidate != null) {
                socketRef.current.emit('signal', socketListId, JSON.stringify({ 'ice': event.candidate }))
            }
        }

        peerConnection.onconnectionstatechange = () => {
            console.log(`Peer ${socketListId} connection state:`, peerConnection.connectionState);
        }

        peerConnection.ontrack = (event) => {
            const targetStream = remoteStreams[socketListId] || new MediaStream();
            remoteStreams[socketListId] = targetStream;

            if (!targetStream.getTracks().some(track => track.id === event.track.id)) {
                targetStream.addTrack(event.track);
            }

            setVideos(() => upsertRemoteVideo(socketListId, targetStream));
        };

        connections[socketListId] = peerConnection;
        pendingIceCandidates[socketListId] = pendingIceCandidates[socketListId] || [];
        addLocalStreamToPeer(peerConnection);
        return peerConnection;
    }

    let getUserMediaSuccess = (stream) => {
        try {
            window.localStream.getTracks().forEach(track => track.stop())
        } catch (e) { console.log(e) }

        window.localStream = stream
        localVideoref.current.srcObject = stream

        for (let id in connections) {
            if (id === socketIdRef.current) continue

            addLocalStreamToPeer(connections[id]);

            connections[id].createOffer().then((description) => {
                console.log(description)
                connections[id].setLocalDescription(description)
                    .then(() => {
                        socketRef.current.emit('signal', id, JSON.stringify({ 'sdp': connections[id].localDescription }))
                    })
                    .catch(e => console.log(e))
            })
        }

        stream.getTracks().forEach(track => track.onended = () => {
            setVideo(false);
            setAudio(false);

            try {
                let tracks = localVideoref.current.srcObject.getTracks()
                tracks.forEach(track => track.stop())
            } catch (e) { console.log(e) }

            let blackSilence = (...args) => new MediaStream([black(...args), silence()])
            window.localStream = blackSilence()
            localVideoref.current.srcObject = window.localStream

            for (let id in connections) {
                addLocalStreamToPeer(connections[id]);

                connections[id].createOffer().then((description) => {
                    connections[id].setLocalDescription(description)
                        .then(() => {
                            socketRef.current.emit('signal', id, JSON.stringify({ 'sdp': connections[id].localDescription }))
                        })
                        .catch(e => console.log(e))
                })
            }
        })
    }

    let getUserMedia = () => {
        if ((video && videoAvailable) || (audio && audioAvailable)) {
            navigator.mediaDevices.getUserMedia({ video: video, audio: audio })
                .then(getUserMediaSuccess)
                .catch((e) => console.log(e))
        } else {
            try {
                let tracks = localVideoref.current.srcObject.getTracks()
                tracks.forEach(track => track.stop())
            } catch {
                console.warn("No local media tracks to stop");
            }
        }
    }





    let getDislayMediaSuccess = (stream) => {
        console.log("HERE")
        try {
            window.localStream.getTracks().forEach(track => track.stop())
        } catch (e) { console.log(e) }

        window.localStream = stream
        localVideoref.current.srcObject = stream

        for (let id in connections) {
            if (id === socketIdRef.current) continue

            addLocalStreamToPeer(connections[id]);

            connections[id].createOffer().then((description) => {
                connections[id].setLocalDescription(description)
                    .then(() => {
                        socketRef.current.emit('signal', id, JSON.stringify({ 'sdp': connections[id].localDescription }))
                    })
                    .catch(e => console.log(e))
            })
        }

        stream.getTracks().forEach(track => track.onended = () => {
            setScreen(false)

            try {
                let tracks = localVideoref.current.srcObject.getTracks()
                tracks.forEach(track => track.stop())
            } catch (e) { console.log(e) }

            let blackSilence = (...args) => new MediaStream([black(...args), silence()])
            window.localStream = blackSilence()
            localVideoref.current.srcObject = window.localStream

            getUserMedia()

        })
    }

    let gotMessageFromServer = (fromId, message) => {
        var signal = JSON.parse(message)

        if (fromId !== socketIdRef.current) {
            const peerConnection = ensurePeerConnection(fromId);
            if (!peerConnection) return;

            if (signal.sdp) {
                peerConnection.setRemoteDescription(new RTCSessionDescription(signal.sdp)).then(() => {
                    pendingIceCandidates[fromId]?.forEach(candidate => {
                        peerConnection.addIceCandidate(candidate).catch(e => console.log(e));
                    });
                    pendingIceCandidates[fromId] = [];

                    if (signal.sdp.type === 'offer') {
                        peerConnection.createAnswer().then((description) => {
                            peerConnection.setLocalDescription(description).then(() => {
                                socketRef.current.emit('signal', fromId, JSON.stringify({ 'sdp': peerConnection.localDescription }))
                            }).catch(e => console.log(e))
                        }).catch(e => console.log(e))
                    }
                }).catch(e => console.log(e))
            }

            if (signal.ice) {
                const iceCandidate = new RTCIceCandidate(signal.ice);

                if (peerConnection.remoteDescription) {
                    peerConnection.addIceCandidate(iceCandidate).catch(e => console.log(e))
                } else {
                    pendingIceCandidates[fromId] = pendingIceCandidates[fromId] || [];
                    pendingIceCandidates[fromId].push(iceCandidate);
                }
            }
        }
    }




    let connectToSocketServer = () => {
        socketRef.current = io(server_url);

        socketRef.current.on('signal', gotMessageFromServer)

        socketRef.current.on('connect', () => {
            connections = {};
            pendingIceCandidates = {};
            remoteStreams = {};
            videoRef.current = [];
            setVideos([]);

            socketIdRef.current = socketRef.current.id
            socketRef.current.emit('join-call', getRoomId())

            socketRef.current.on('chat-message', addMessage)

            socketRef.current.on('user-left', (id) => {
                connections[id]?.close();
                delete connections[id];
                delete pendingIceCandidates[id];
                delete remoteStreams[id];
                setVideos((videos) => videos.filter((video) => video.socketId !== id))
            })

            socketRef.current.on('user-joined', (id, clients) => {
                clients.forEach((socketListId) => {
                    const peerConnection = ensurePeerConnection(socketListId);
                    if (!peerConnection) return;

                    // Add the local video stream
                    if (window.localStream !== undefined && window.localStream !== null) {
                        addLocalStreamToPeer(peerConnection);
                    } else {
                        let blackSilence = (...args) => new MediaStream([black(...args), silence()])
                        window.localStream = blackSilence()
                        addLocalStreamToPeer(peerConnection);
                    }
                })

                if (id === socketIdRef.current) {
                    for (let id2 in connections) {
                        if (id2 === socketIdRef.current) continue

                        addLocalStreamToPeer(connections[id2]);

                        connections[id2].createOffer().then((description) => {
                            connections[id2].setLocalDescription(description)
                                .then(() => {
                                    socketRef.current.emit('signal', id2, JSON.stringify({ 'sdp': connections[id2].localDescription }))
                                })
                                .catch(e => console.log(e))
                        })
                    }
                } else {
                    const peerConnection = ensurePeerConnection(id);
                    if (!peerConnection) return;

                    addLocalStreamToPeer(peerConnection);
                }
            })
        })
    }

    let silence = () => {
        let ctx = new AudioContext()
        let oscillator = ctx.createOscillator()
        let dst = oscillator.connect(ctx.createMediaStreamDestination())
        oscillator.start()
        ctx.resume()
        return Object.assign(dst.stream.getAudioTracks()[0], { enabled: false })
    }
    let black = ({ width = 640, height = 480 } = {}) => {
        let canvas = Object.assign(document.createElement("canvas"), { width, height })
        canvas.getContext('2d').fillRect(0, 0, width, height)
        let stream = canvas.captureStream()
        return Object.assign(stream.getVideoTracks()[0], { enabled: false })
    }

    let handleVideo = () => {
        const nextVideo = !video;
        setVideo(nextVideo);
        window.localStream?.getVideoTracks().forEach(track => {
            track.enabled = nextVideo;
        });
    }
    let handleAudio = () => {
        const nextAudio = !audio;
        setAudio(nextAudio);
        window.localStream?.getAudioTracks().forEach(track => {
            track.enabled = nextAudio;
        });
    }

    useEffect(() => {
        if (screen !== undefined) {
            getDislayMedia();
        }
    }, [screen])
    let handleScreen = () => {
        setScreen(!screen);
    }

    let handleEndCall = () => {
        const tracks = localVideoref.current?.srcObject?.getTracks?.() ?? [];
        tracks.forEach(track => track.stop())
        Object.values(connections).forEach(connection => connection.close());
        connections = {};
        pendingIceCandidates = {};
        remoteStreams = {};
        window.location.href = "/"
    }

    const addMessage = (data, sender, socketIdSender) => {
        setMessages((prevMessages) => [
            ...prevMessages,
            { sender: sender, data: data }
        ]);
        if (socketIdSender !== socketIdRef.current) {
            setNewMessages((prevNewMessages) => prevNewMessages + 1);
        }
    };



    let sendMessage = () => {
        if (!message.trim()) return;
        socketRef.current.emit('chat-message', message, username)
        setMessage("");

        // this.setState({ message: "", sender: username })
    }

    
    let connect = async () => {
        if (!username.trim()) return;
        if (!window.localStream || window.localStream.getTracks().length === 0) {
            await getPermissions();
        }
        setAskForUsername(false);
        getMedia();
    }


    return (
        <div>

            {askForUsername === true ?

                <div>


                    <h2>Enter into Lobby </h2>
                    <TextField id="outlined-basic" label="Username" value={username} onChange={e => setUsername(e.target.value)} variant="outlined" />
                    <Button variant="contained" onClick={connect}>Connect</Button>


                    <div>
                        <video ref={setLocalVideoRef} autoPlay muted playsInline></video>
                    </div>
                    <div className={styles.lobbyControls}>
                        <IconButton onClick={handleVideo}>
                            {(video === true) ? <VideocamIcon /> : <VideocamOffIcon />}
                        </IconButton>
                        <IconButton onClick={handleAudio}>
                            {audio === true ? <MicIcon /> : <MicOffIcon />}
                        </IconButton>
                    </div>

                </div> :


                <div className={styles.meetVideoContainer}>

                    {showModal ? <div className={styles.chatRoom}>

                        <div className={styles.chatContainer}>
                            <h1>Chat</h1>

                            <div className={styles.chattingDisplay}>

                                {messages.length !== 0 ? messages.map((item, index) => {

                                    console.log(messages)
                                    return (
                                        <div style={{ marginBottom: "20px" }} key={index}>
                                            <p style={{ fontWeight: "bold" }}>{item.sender}</p>
                                            <p>{item.data}</p>
                                        </div>
                                    )
                                }) : <p>No Messages Yet</p>}


                            </div>

                            <div className={styles.chattingArea}>
                                <TextField value={message} onChange={(e) => setMessage(e.target.value)} id="outlined-basic" label="Enter Your chat" variant="outlined" />
                                <Button variant='contained' onClick={sendMessage}>Send</Button>
                            </div>


                        </div>
                    </div> : <></>}


                    <div className={styles.buttonContainers}>
                        <IconButton onClick={handleVideo} style={{ color: "white" }}>
                            {(video === true) ? <VideocamIcon /> : <VideocamOffIcon />}
                        </IconButton>
                        <IconButton onClick={handleEndCall} style={{ color: "red" }}>
                            <CallEndIcon  />
                        </IconButton>
                        <IconButton onClick={handleAudio} style={{ color: "white" }}>
                            {audio === true ? <MicIcon /> : <MicOffIcon />}
                        </IconButton>

                        {screenAvailable === true ?
                            <IconButton onClick={handleScreen} style={{ color: "white" }}>
                                {screen === true ? <StopScreenShareIcon /> : <ScreenShareIcon />}
                            </IconButton> : <></>}

                        <Badge badgeContent={newMessages} max={999} color='warning'>
                            <IconButton onClick={() => {
                                setModal(!showModal);
                                setNewMessages(0);
                            }} style={{ color: "white" }}>
                                <ChatIcon />                        </IconButton>
                        </Badge>

                    </div>


                    <div className={styles.localVideoTile}>
                        <video className={styles.meetUserVideo} ref={setLocalVideoRef} autoPlay muted playsInline></video>
                        <span>You</span>
                    </div>

                    <div className={`${styles.conferenceView} ${showModal ? styles.conferenceWithChat : ""}`}>
                        {videos.map((video) => (
                            <RemoteVideo key={video.socketId} socketId={video.socketId} stream={video.stream} />

                        ))}

                    </div>

                </div>

            }

        </div>
    )
}
