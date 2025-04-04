const express = require('express');
const app = express();
const http = require('http').createServer(app);
const cors = require("cors");
const path = require('path');
const port = process.env.PORT || 3000;
const io = require("socket.io")(http, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"],
    },
});

app.use(cors());
app.use(express.static(path.join(__dirname, 'public')));

app.get('/join', (req, res) => {
    res.sendFile(path.join(__dirname, 'public/index.html'));
});

http.listen(port, () => {
    console.log(`Server Socket.IO đang chạy trên cổng ${port}`);
});

const userRooms = {}; // { roomId: { users: [ { ten, peerId, socketId }, ... ], ...} - Tracks users in rooms
const userSockets = {}; // { socketId: peerId, ...} - Tracks socketId to peerId

io.on("connection", (socket) => {
    console.log("Client đã kết nối!", socket.id);

    socket.on("SHARE_SCREEN", ({ peerID, isSharing }) => {
        let roomId = null;
        for (const room in userRooms) {
            if (userRooms[room].users.some(user => user.peerID === peerID)) {
                roomId = room;
                break;
            }
        }
        if (roomId) {
            io.to(roomId).emit("UPDATE_SHARE_SCREEN", { peerID, isSharing });
        }
    });
    
    
    socket.on("TOGGLE_CAMERA", ({ peerID, isEnabled }) => {
        let roomId = null;
        for (const room in userRooms) {
            if (userRooms[room].users.some(user => user.peerID === peerID)) {
                roomId = room;
                break;
            }
        }
        if (roomId) {
            io.to(roomId).emit("UPDATE_CAMERA_STATUS", { peerID, isEnabled });
        }
    });
    
    
    
    
    // Xử lý đăng ký người dùng và tham gia phòng
    socket.on("JOIN_ROOM", (data) => {
        const { username, peerID, roomId } = data;

        // Check if roomId exists, if not create it
        if (!userRooms[roomId]) {
            userRooms[roomId] = { users: [] };
        }

        // Check if the username is already used in that room
        const isUsernameTaken = userRooms[roomId].users.some((user) => user.ten === username);

        if (isUsernameTaken) {
            socket.emit("JOIN_ROOM_FAILED", "Tên đăng nhập đã tồn tại trong phòng!");
            
            return;
        }
        // Join the room
        socket.join(roomId);

        // Store user info and associated socket ID
        userRooms[roomId].users.push({ ten: username, peerID, socketId: socket.id });
        userSockets[socket.id] = peerID;

        // Notify everyone in the room except the sender
        socket.to(roomId).emit("NEW_USER_JOINED", {
            ten: username,
            peerID,
            roomId
        });

        // Send the list of users currently in the room to the new user
        socket.emit("ROOM_USER_LIST", {
            users: userRooms[roomId].users,
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
            const userIndex = userRooms[roomId].users.findIndex((user) => user.socketId === socket.id);
            if (userIndex !== -1) {
                disconnectedPeerId = userRooms[roomId].users[userIndex].peerID;
                disconnectedRoomId = roomId;
                userRooms[roomId].users.splice(userIndex, 1);
                break;
            }
        }

        if (disconnectedPeerId) {
            delete userSockets[socket.id];
            if (userRooms[disconnectedRoomId].users.length == 0) {
                delete userRooms[disconnectedRoomId];
            } else {
                io.to(disconnectedRoomId).emit("USER_LEFT_ROOM", disconnectedPeerId);
            }
        }
    });
    // NEW: Add the CHECK_USER_IN_ROOM handler
    socket.on('CHECK_USER_IN_ROOM', ({ peerId, currentRoomId }, callback) => {
        let isInRoom = false;
        if (userRooms[currentRoomId]) {
            for (let user of userRooms[currentRoomId].users) {
                if (user.peerID == peerId) {
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
            for (let user of userRooms[roomId].users) {
                if (user.peerID == peerId) {
                    check = true;
                    break;
                }
            }
            if (check) break;
        }
        callback(check);
    });

    socket.on("CHECK_ROOM_EXIST", (roomId, callback) => {
        const roomExists = userRooms.hasOwnProperty(roomId) && userRooms[roomId].users.length > 0;
        callback(roomExists);
      });

    socket.on("CREATE_ROOM", (roomId, callback) => {
        if (!userRooms[roomId]) {
            userRooms[roomId] = { users: [] };
            callback(true);
        } else {
            callback(false);
        }
    });
    socket.on("REQUEST_SHARE_SCREEN_STATUS", (roomId) => {
        if (userRooms[roomId]) {
          userRooms[roomId].users.forEach(user => {
            // Giả sử bạn lưu trạng thái chia sẻ màn hình trong userRooms (cần thêm trường isSharing)
            const isSharing = user.isSharing || false; // Mặc định false nếu chưa có
            socket.emit("UPDATE_SHARE_SCREEN", { peerID: user.peerID, isSharing });
          });
        }
      });
      
      // Cập nhật khi SHARE_SCREEN được gọi
      socket.on("SHARE_SCREEN", ({ peerID, isSharing }) => {
        let roomId = null;
        for (const room in userRooms) {
          const user = userRooms[room].users.find(u => u.peerID === peerID);
          if (user) {
            roomId = room;
            user.isSharing = isSharing; // Lưu trạng thái chia sẻ
            break;
          }
        }
        if (roomId) {
          io.to(roomId).emit("UPDATE_SHARE_SCREEN", { peerID, isSharing });
        }
      });
    
    // Relay ICE candidates and SDPs (offers/answers)
    socket.on("RELAY_ICE", (data) => {
        const { peerId, candidate } = data;
        const targetSocketId = Object.keys(userSockets).find(key => userSockets[key] === peerId);
        if (targetSocketId) {
            io.to(targetSocketId).emit("ICE_CANDIDATE", candidate);
        }
    });

    socket.on("RELAY_SDP", (data) => {
        const { peerId, sdp } = data;
        const targetSocketId = Object.keys(userSockets).find(key => userSockets[key] === peerId);
        if (targetSocketId) {
            io.to(targetSocketId).emit("SESSION_DESCRIPTION", { sdp, peerId: userSockets[socket.id] });
        }
    });
    socket.on("SEND_MESSAGE", ({ roomId, message, username, time }) => {
        io.to(roomId).emit("NEW_MESSAGE", { username, message, time });
      });
      
});
/** Turn Xisys */
// const https = require("https");
// app.get("/getIceServers", (req, res) => {
//     let options = {
//         host: "global.xirsys.net",
//         path: "/_turn/MyFirstApp",
//         method: "PUT",
//         headers: {
//             "Authorization": "Basic " + Buffer.from("Tuanhai:a7d354ba-fd3b-11ef-86ae-0242ac150006").toString("base64"),
//             "Content-Type": "application/json"
//         }
//     };

//     let httpreq = https.request(options, function (httpres) {
//         let str = "";
//         httpres.on("data", (data) => { str += data; });
//         httpres.on("error", (e) => { console.log("Lỗi lấy ICE Servers:", e); });
//         httpres.on("end", () => {
//             res.send(str);
//         });
//     });

//     httpreq.on("error", (e) => { console.log("Request lỗi:", e); });
//     httpreq.end();
// });
