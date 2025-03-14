const express = require('express');
const app = express();
const http = require('http').createServer(app);
const cors = require("cors");
app.use(cors());
const path = require('path');
const port = process.env.PORT || 3000;
const io = require("socket.io")(http, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"],
    },
});

app.use(express.static(path.join(__dirname, '../public')));

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, '../public/index.html'));
});

http.listen(3000, () => {
    console.log(`Server Socket.IO đang chạy trên cổng ${port}`);
});

const userRooms = {}; // { roomId: [ { ten, peerId }, ... ], ...} - Tracks users in rooms
const userSockets = {}; // { peerId: socketId, ...} - Tracks socketId to peerId

io.on("connection", (socket) => {
    console.log("Client đã kết nối!", socket.id);

    // Xử lý đăng ký người dùng và tham gia phòng
    socket.on("JOIN_ROOM", (data) => {
        const { username, peerID, roomId } = data;

        // Check if roomId exists, if not create it
        if (!userRooms[roomId]) {
            userRooms[roomId] = [];
        }

        // Check if the username is already used in that room
        const isUsernameTaken = userRooms[roomId].some((user) => user.ten === username);

        if(isUsernameTaken){
            socket.emit("JOIN_ROOM_FAILED", "Tên đăng nhập đã tồn tại trong phòng!");
            return;
        }
        // Join the room
        socket.join(roomId);

        // Store user info and associated socket ID
        userRooms[roomId].push({ ten: username, peerID });
        userSockets[peerID] = socket.id;

        // Notify everyone in the room except the sender
        socket.to(roomId).emit("NEW_USER_JOINED", {
            ten: username,
            peerID,
            roomId
        });

        // Send the list of users currently in the room to the new user
        socket.emit("ROOM_USER_LIST", {
            users: userRooms[roomId],
            currentPeerID: peerID
        });
        console.log(userRooms)
    });

    // Xử lý ngắt kết nối
    socket.on("disconnect", () => {
        console.log("Client đã ngắt kết nối!", socket.id);
        // Find the room and the peerID of the disconnected socket
        let disconnectedPeerId = null;
        let disconnectedRoomId = null;

        for (const roomId in userRooms) {
            const userIndex = userRooms[roomId].findIndex((user) => userSockets[user.peerID] === socket.id);
            if (userIndex !== -1) {
                disconnectedPeerId = userRooms[roomId][userIndex].peerID;
                disconnectedRoomId = roomId;
                userRooms[roomId].splice(userIndex, 1);
                break;
            }
        }
        
        if (disconnectedPeerId) {
          delete userSockets[disconnectedPeerId];
          if(userRooms[disconnectedRoomId].length == 0){
            delete userRooms[disconnectedRoomId];
          }else{
            io.to(disconnectedRoomId).emit("USER_LEFT_ROOM", disconnectedPeerId);
          }
        }
    });
    // NEW: Add the CHECK_USER_IN_ROOM handler
    socket.on('CHECK_USER_IN_ROOM', ({peerId,currentRoomId}, callback) => {
        let isInRoom = false;
        if (userRooms[currentRoomId]) {
            for (let user of userRooms[currentRoomId]) {
              if(user.peerID == peerId) {
                isInRoom = true;
                break;
              }
            }
          }
          callback(isInRoom);
      });

    socket.on('CHECK_USER_EXIST', (peerId, callback) => {
        let check = false;
        for (let roomId in userRooms) {
            for (let user of userRooms[roomId]) {
              if(user.peerID == peerId){
                check = true;
                break;
              }
            }
            if(check) break;
          }
        callback(check);
      });
    // Relay ICE candidates and SDPs (offers/answers)
    socket.on("RELAY_ICE", (data) => {
        const { peerId, candidate } = data;
        const targetSocketId = userSockets[peerId];
        if(targetSocketId){
          io.to(targetSocketId).emit("ICE_CANDIDATE", candidate);
        }
    });

    socket.on("RELAY_SDP", (data) => {
        const { peerId, sdp } = data;
        const targetSocketId = userSockets[peerId];
        if(targetSocketId){
          io.to(targetSocketId).emit("SESSION_DESCRIPTION", sdp);
        }
    });
});

const https = require("https");
app.get("/getIceServers", (req, res) => {
    let options = {
        host: "global.xirsys.net",
        path: "/_turn/MyFirstApp",
        method: "PUT",
        headers: {
            "Authorization": "Basic " + Buffer.from("Tuanhai:a7d354ba-fd3b-11ef-86ae-0242ac150006").toString("base64"),
            "Content-Type": "application/json"
        }
    };

    let httpreq = https.request(options, function (httpres) {
        let str = "";
        httpres.on("data", (data) => { str += data; });
        httpres.on("error", (e) => { console.log("Lỗi lấy ICE Servers:", e); });
        httpres.on("end", () => {
            res.send(str);
        });
    });

    httpreq.on("error", (e) => { console.log("Request lỗi:", e); });
    httpreq.end();
});

//ngon rồi
