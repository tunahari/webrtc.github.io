const socket = io("http://localhost:3000"); // comment khi deploy local
// const socket = io("https://3000-tunahari-webrtcgithubio-5y4u2ynx3zf.ws-us118.gitpod.io/"); // comment khi deploy

let currentRoomId = ""; // Biến để lưu RoomID hiện tại
let userRoomsClient = {};
let peer;
let localStream;
const peers = {}; // { peerId: RTCPeerConnection, ... }
const statusElement = document.querySelector(".status");

async function getIceServers() {
  try {
    const response = await fetch("http://localhost:3000/getIceServers"); // comment khi deploy
    // const response = await fetch("https://3000-tunahari-webrtcgithubio-5y4u2ynx3zf.ws-us118.gitpod.io/getIceServers"); // comment khi chạy local
    const data = await response.json();
    return data.v.iceServers;
  } catch (error) {
    console.error("Lỗi lấy ICE servers:", error);
    return [{ urls: "stun:stun.l.google.com:19302" }]; // Hệ thống STUN Dự phòng
  }
}

getIceServers().then((iceServers) => {
  peer = new Peer(undefined, { config: { iceServers } });
  setupPeerEvents();
});

function setupPeerEvents() {
  peer.on("open", (id) => {
    $("#my-peer").append(id);
    $("#my-peer-id").append(id);

    // Move the JOIN_ROOM event listener inside peer.on("open")
    $("#btnJoinRoom").click(() => {
      const username = $("#txtUsername").val();
      const roomId = $("#txtRoomId").val();
      if (!username || !roomId) {
        return alert("Vui lòng nhập đầy đủ thông tin!");
      }
      //kiểm tra dữ liệu trước khi gửi
      if (username.trim().length == 0 || roomId.trim().length == 0) {
        return alert("Vui lòng nhập đầy đủ thông tin!");
      }

      socket.emit("JOIN_ROOM", { username, peerID: id, roomId });
    });
  });

  peer.on("call", (call) => {
    if (peers[call.peer]) {
      console.log("Call already exists with", call.peer);
      call.close();
      return;
    }
  
    openStream().then((stream) => {
      call.answer(stream); // Trả lời cuộc gọi bằng localStream
      playStream("localStream", stream);
  
      // Khi nhận stream từ người gọi, hiển thị lên UI
      call.on("stream", (remoteStream) => {
        playStream(`remoteStream-${call.peer}`, remoteStream);
        createRemoteVideo(call.peer);
      });
  
      call.on("close", () => {
        removeRemoteVideo(call.peer);
        delete peers[call.peer];
      });
  
      // Lưu vào danh sách peers
      peers[call.peer] = call;
    });
  });
  
  
}

$("#div-chat").hide(); // Ẩn div-chat ở đầu

// Handle successful room join
socket.on("ROOM_USER_LIST", (data) => {
  const { users, currentPeerID } = data;
  const username = $("#txtUsername").val(); // Lấy tên người dùng từ input
  const roomId = $("#txtRoomId").val(); //lấy room id

  currentRoomId = roomId; // Lưu RoomID hiện tại
  userRoomsClient[roomId] = users;

  $("#div-chat").show();
  $("#div-signup").hide();

  // Hiển thị thông tin phòng và người dùng
  $("#room-info").text(`Đây là phòng có id là: ${roomId}`);
  $("#user-info").text(`Chào bạn: ${username}`);

  $("#ulUser").empty();
  users.forEach((user) => {
    if (user.peerID != currentPeerID) {
      addNewUser(user);
    }
  });
});

socket.on("NEW_USER_JOINED", (user) => {
  if (currentRoomId) {
    //Nếu có room hiện tại thì thêm user vào
    if (!userRoomsClient[currentRoomId]) {
      userRoomsClient[currentRoomId] = [];
    }
    userRoomsClient[currentRoomId].push(user);
    addNewUser(user);
  }
  // addNewUser(user);
});

socket.on("USER_LEFT_ROOM", (peerId) => {
  console.log(`User ${peerId} left the room`);
  $(`#${peerId}`).remove();
  removeRemoteVideo(peerId);
  if (peers[peerId]) {
    peers[peerId].close();
    delete peers[peerId];
  }
  //delete user in userRoomsClient
  for (let roomId in userRoomsClient) {
    let index = -1;
    for (let user of userRoomsClient[roomId]) {
      index++;
      if (user.peerID == peerId) {
        userRoomsClient[roomId].splice(index, 1);
      }
    }
  }
});

socket.on("JOIN_ROOM_FAILED", (reason) => {
  alert(reason);
});

/********************************************* Xử lý phím bấm media ***************************************/
async function openStream() {
  const config = { audio: true, video: true };
  try {
    localStream = await navigator.mediaDevices.getUserMedia(config);
    playStream("localStream", localStream);
    return localStream;
  } catch (error) {
    console.error("Lỗi khi truy cập media:", error);
  }
}

async function playStream(idVideoTag, stream) {
  const video = document.getElementById(idVideoTag);
  if (video.srcObject !== stream) {
    video.srcObject = stream;
  }
  video.onloadedmetadata = async () => {
    try {
      await video.play();
    } catch (error) {
      console.error("Lỗi phát video:", error);
    }
  };
}

// Xử lý sự kiện click cho #btnCall
// Xử lý sự kiện click cho #btnCall
$("#btnCall").click(function () {
  const remotePeerId = $("#remoteID").val();
  $("#remoteID").val(""); //clear input

  if (!remotePeerId || remotePeerId.trim() === "") {
    return alert("Vui lòng nhập ID người dùng muốn gọi!");
  }
  // Kiểm tra xem có gọi cho chính mình không
  if (remotePeerId == peer.id) {
    return alert("Không thực hiện được cuộc gọi đến chính mình!");
  }

  // Kiểm tra xem người dùng có trong phòng hay không.
  let isInRoom = false;
  let isExistUser = false; // Biến kiểm tra xem ID có tồn tại ở bất kì phòng nào không
  //Duyệt qua userRoomClient xem user có tồn tại ở room nào không
  for (let roomId in userRoomsClient) {
    for (let user of userRoomsClient[roomId]) {
      if (user.peerID == remotePeerId) {
        isExistUser = true;
        //Kiểm tra có ở trong cùng phòng hiện tại không
        if (roomId == currentRoomId) {
          isInRoom = true;
        }
        break; //tìm thấy rồi thì thoát luôn
      }
    }
    //if(isExistUser) break; //tìm thấy rồi thì thoát luôn //xóa dòng này
  }
  //Kiểm tra user có tồn tại không thông qua server
  socket.emit("CHECK_USER_EXIST", remotePeerId, (check) => {
    // Gọi hàm openStream để mở stream
    openStream().then((stream) => {
      // Nếu người dùng ở trong phòng mới thực hiện cuộc gọi
      if (isInRoom) {
        callToPeer(remotePeerId, stream);
      } else if (check) {
        // Nếu tồn tại nhưng không ở cùng phòng
        alert("Người dùng đang ở RoomID khác. Không thể gọi");
      } else {
        alert("Nhập sai ID người dùng, vui lòng nhập lại");
      }
    });
  });
});

function toggleMic() {
  if (localStream) {
    let audioTracks = localStream.getAudioTracks();
    audioTracks.forEach((track) => (track.enabled = !track.enabled));
    document.getElementById("toggleMic").innerText = audioTracks[0].enabled
      ? "Tắt Mic"
      : "Bật Mic";
    console.log(
      `Microphone ${
        audioTracks[0].enabled ? "enabled (Đã Bật)" : "disabled (Đã Tắt)"
      }`
    );
  }
}

// function toggleCamera() {
//   if (localStream) {
//     let videoTracks = localStream.getVideoTracks();
//     videoTracks.forEach((track) => (track.enabled = !track.enabled));
//     document.getElementById("toggleCam").innerText = videoTracks[0].enabled
//       ? "Tắt Camera"
//       : "Bật Camera";
//     console.log(
//       `Camera ${
//         videoTracks[0].enabled ? "enabled (Đã Bật)" : "disabled (Đã Tắt)"
//       }`
//     );
//   }
// }

function toggleCamera() {
  if (!localStream) return;

  let videoTracks = localStream.getVideoTracks();
  let isEnabled = !videoTracks[0].enabled;

  videoTracks.forEach(track => track.enabled = isEnabled);
  document.getElementById("toggleCam").innerText = isEnabled ? "Tắt Camera" : "Bật Camera";
  video.style.filter = "none"; // Xóa filte
  // Gửi sự kiện cập nhật trạng thái camera lên server
  socket.emit("TOGGLE_CAMERA", { peerID: peer.id, isEnabled });
  video.style.filter = "none"; // Xóa filte
  // Không thay đổi video nếu đang chia sẻ màn hình
  if (!isSharingScreen) {
    Object.values(peers).forEach(call => {
      const sender = call.peerConnection.getSenders().find(s => s.track.kind === "video");
      if (sender) {
        sender.replaceTrack(videoTracks[0]); // Chỉ thay thế track, không xóa
      }
    });
  }
    // ✅ Loại bỏ hiệu ứng làm tối video
      video.style.filter = "none"; // Xóa filter
  
}





function toggleMute() {
  let videoElement = document.getElementById("localStream");
  videoElement.muted = !videoElement.muted;
  document.getElementById("muteButton").innerText = videoElement.muted
    ? "Bật Âm Thanh"
    : "Tắt Âm Thanh";
  console.log(
    `Audio ${videoElement.muted ? "muted (Đã Câm )" : "unmuted (Hết Câm️)"}`
  );
}

document.getElementById("toggleMic").addEventListener("click", toggleMic);
document.getElementById("toggleCam").addEventListener("click", toggleCamera);
document.getElementById("muteButton").addEventListener("click", toggleMute);

// window.onload = openStream;
//--------------------------------------------------------------------------------------------------------

function addNewUser(user) {
  const { ten, peerID } = user;
  $("#ulUser").append(`<li id="${peerID}">🤝 ${ten}</li>`);
}
$("#ulUser").on("click", "li", function () {
  const peerId = $(this).attr("id");
  const tenhienthi = document.getElementById(peerId).textContent;
  console.log("id của", tenhienthi, "là:", peerId);
  //kiểm tra có gọi cho chính mình không
  if (peerId == peer.id)
    return alert("Không thực hiện được cuộc gọi đến chính mình!");
  // Kiểm tra xem người dùng có trong phòng hay không.
  let isInRoom = false;
  if (userRoomsClient[currentRoomId]) {
    for (let user of userRoomsClient[currentRoomId]) {
      if (user.peerID == peerId) {
        isInRoom = true;
        break;
      }
    }
  }
  // Nếu người dùng ở trong phòng mới thực hiện cuộc gọi
  if (isInRoom) {
    openStream().then((stream) => {
      callToPeer(peerId, stream);
    });
  } else {
    alert("Người dùng đang ở RoomID khác. Không thể gọi");
  }
});

socket.on("connect", () => {
  console.log("Đã kết nối với server!");
  statusElement.textContent = "Kết nối đến máy chủ thành công!";
  statusElement.style.color = "blue";
});

// Hàm kết thúc cuộc gọi
function endCall(peerId) {
  if (peers[peerId]) {
    peers[peerId].close();
    delete peers[peerId];
  }

  removeRemoteVideo(peerId);
}
// Sự kiện click cho nút kết thúc cuộc gọi
$("#btnEndCall").click(() => {
  for (let peerId in peers) {
    endCall(peerId);
  }
});

// Hàm gọi tới một peer cụ thể
function callToPeer(peerId, stream) {
  if (peers[peerId]) {
    console.log("Đã tồn tại kết nối đến:", peerId);
    return;
  }

  console.log("Gọi đến peer:", peerId);
  const call = peer.call(peerId, stream);

  call.on("stream", (remoteStream) => {
    playStream(`remoteStream-${peerId}`, remoteStream);
    createRemoteVideo(peerId);
  });

  call.on("close", () => {
    console.log("Cuộc gọi kết thúc với:", peerId);
    endCall(peerId);
  });

  call.on("error", (err) => {
    console.error("Lỗi cuộc gọi:", err);
  });

  peers[peerId] = call; // Lưu kết nối vào danh sách peers
}


function createRemoteVideo(peerId) {
  if (document.getElementById(`remoteStream-${peerId}`)) return; // Tránh tạo trùng video

  const user = userRoomsClient[currentRoomId]?.find(u => u.peerID === peerId);
  const username = user ? user.ten : `User ${peerId}`;

  const videoContainer = document.getElementById("remoteStreams");

  // Tạo video element
  const newVideo = document.createElement("video");
  newVideo.id = `remoteStream-${peerId}`;
  newVideo.autoplay = true;
  newVideo.playsInline = true;
  newVideo.setAttribute("data-username", username);
  newVideo.classList.add("video-peer");

  // Thêm sự kiện hover để hiển thị tên
  newVideo.addEventListener("mouseenter", showUsername);
  newVideo.addEventListener("mouseleave", hideUsername);

  // Tạo phần hiển thị tên
  const nameTag = document.createElement("div");
  nameTag.classList.add("video-username");
  nameTag.innerText = username;
  nameTag.style.opacity = "0"; // Ẩn ban đầu
  nameTag.style.pointerEvents = "none"; // Không ảnh hưởng đến sự kiện chuột

  // Thêm video + tên vào container
  const wrapper = document.createElement("div");
  wrapper.classList.add("video-wrapper");
  wrapper.appendChild(newVideo);
  wrapper.appendChild(nameTag);

  videoContainer.appendChild(wrapper);
}


function removeRemoteVideo(peerId) {
  const videoElement = document.getElementById(`remoteStream-${peerId}`);
  if (videoElement) {
    videoElement.srcObject = null;
    videoElement.remove();
  }
}
// Listen for ICE candidates and SDPs
socket.on("ICE_CANDIDATE", (candidate) => {
  let peerId = "";
  for (const key in peers) {
    if (peers[key].peerConnection) {
      peerId = key;
    }
  }
  if (peers[peerId] && candidate) {
    peers[peerId].peerConnection.addIceCandidate(candidate).catch((error) => {
      console.error("Lỗi thêm ICE Candidate:", error);
    });
  }
});

socket.on("SESSION_DESCRIPTION", ({ sdp, peerId }) => {
  if (peers[peerId]) {
    peers[peerId].peerConnection.setRemoteDescription(
      new RTCSessionDescription(sdp)
    );
  }
});

let isSharingScreen = false; // Biến theo dõi trạng thái chia sẻ màn hình

document.getElementById("shareScreen").addEventListener("click", async () => {
  try {
    const screenStream = await navigator.mediaDevices.getDisplayMedia({ video: true });
    const videoTrack = screenStream.getVideoTracks()[0];
    isSharingScreen = true;

    // Thay thế video track trong tất cả kết nối
    Object.values(peers).forEach(call => {
      const sender = call.peerConnection.getSenders().find(s => s.track.kind === "video");
      if (sender) sender.replaceTrack(videoTrack);
    });

    // Hiển thị lên chính giao diện người chia sẻ
    playStream("localStream", screenStream);
    document.getElementById("localStream").style.border = "5px solid red"; // Đánh dấu chia sẻ

    // Khi dừng chia sẻ, tự động quay lại camera
    videoTrack.onended = async () => {
      isSharingScreen = false; // Cập nhật trạng thái
      const camStream = await openStream();
      const camTrack = camStream.getVideoTracks()[0];

      Object.values(peers).forEach(call => {
        const sender = call.peerConnection.getSenders().find(s => s.track.kind === "video");
        if (sender) sender.replaceTrack(camTrack);
      });

      playStream("localStream", camStream);
      document.getElementById("localStream").style.border = "none"; // Xóa viền đỏ
    };

    // Gửi sự kiện thông báo tới server
    socket.emit("SHARE_SCREEN", { peerID: peer.id, isSharing: true });

  } catch (err) {
    console.error("Lỗi chia sẻ màn hình:", err);
  }
});




socket.on("UPDATE_SHARE_SCREEN", ({ peerID, isSharing }) => {
  const videoElement = document.getElementById(`remoteStream-${peerID}`);
  if (videoElement) {
    videoElement.style.border = isSharing ? "5px solid red" : "none";
  }
});

socket.on("UPDATE_CAMERA_STATUS", ({ peerID, isEnabled }) => {
  const videoElement = document.getElementById(`remoteStream-${peerID}`);
  
  if (videoElement) {
    if (!isEnabled) {
      videoElement.style.filter = "brightness(0.3)"; // Làm tối video khi tắt camera
    } else {
      videoElement.style.filter = "brightness(1)"; // Khôi phục khi bật lại
    }
  }
});


function showUsername(event) {
  const video = event.target;
  const wrapper = video.parentElement;
  const nameTag = wrapper.querySelector(".video-username");
  nameTag.style.opacity = "1"; // Hiển thị tên khi di chuột vào
}

function hideUsername(event) {
  const video = event.target;
  const wrapper = video.parentElement;
  const nameTag = wrapper.querySelector(".video-username");
  nameTag.style.opacity = "0"; // Ẩn tên khi rời chuột
}

document.getElementById("send-chat").addEventListener("click", sendMessage);
document.getElementById("chat-input").addEventListener("keypress", (e) => {
  if (e.key === "Enter") sendMessage();
});

function sendMessage() {
  const message = document.getElementById("chat-input").value.trim();
  if (!message) return;

  const username = $("#txtUsername").val() || "Guest";
  const time = new Date().toLocaleTimeString();

  console.log("📤 Sending message:", { roomId: currentRoomId, message, username, time });

  socket.emit("SEND_MESSAGE", { roomId: currentRoomId, message, username, time });

  document.getElementById("chat-input").value = "";
}


socket.on("NEW_MESSAGE", ({ username, message, time }) => {
  console.log("📥 New message received:", { username, message, time });

  const chatBox = document.getElementById("chat-box");
  const isSelf = username === $("#txtUsername").val();
  
  const messageHTML = `
    <div class="message ${isSelf ? 'right' : 'left'}">
      <img src="https://via.placeholder.com/35" class="avatar">
      <div class="message-content">
        <strong>${username}</strong>
        <p>${message}</p>
        <span class="message-time">${time}</span>
      </div>
    </div>`;

  chatBox.innerHTML += messageHTML;
  chatBox.scrollTop = chatBox.scrollHeight;
});






