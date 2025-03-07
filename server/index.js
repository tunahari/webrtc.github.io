const express = require('express');
const app = express();
const http = require('http').createServer(app);

const path = require('path');
const port = process.env.PORT || 3000;
const io = require("socket.io")(http, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"],
  },
});

app.use(express.static(path.join(__dirname, '../'))); // Phục vụ các file tĩnh từ thư mục gốc

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '../index.html')); // Phục vụ file index.html
});

http.listen(3000, () => {
  console.log('Server Socket.IO đang chạy trên cổng 3000');
});

const arrUserInfo = [];
io.on("connection", (socket) => {
  console.log("Client đã kết nối!");
//Nhận socket tu client
  socket.on("NGUOI_DUNG_DANG_KY", (user) => {
    const isExist = arrUserInfo.some((e) => e.ten === user.ten);
    socket.peerID = user.peerID;
    if (isExist) return socket.emit("DANG_KY_THAT_BAI"); //Kiểm tra  nếu isExits trả về tru thì gửi socket "DANG_KY_THAT_BAI" và return luônluôn
    arrUserInfo.push(user);
    socket.emit("List_Nguoi_Dung_Online", arrUserInfo);
    socket.broadcast.emit("Have_New_User", user);
    // console.log(username);
  });

  //xử lý này xảy ra khi soket của 1 client disconnect (thêm ed)
  socket.on("disconnect", () => {
   const index = arrUserInfo.findIndex(e => e.peerID === socket.peerID);
   arrUserInfo.splice(index, 1);
   socket.broadcast.emit("USER_DISCONNECT", socket.peerID);
  });
});

// console.log(`Server Socket.IO đang chạy trên cổng ${port}`);
