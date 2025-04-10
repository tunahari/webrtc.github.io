const socket = io("http://localhost:3000"); // comment khi deploy local
document.getElementById("txtRoomId").value = randomString(15);
let currentRoomId = ""; // Biến để lưu RoomID hiện tại
let userRoomsClient = {};
let peer;
let localStream;
const peers = {}; // { peerId: RTCPeerConnection, ... }
const statusElement = document.querySelector(".status");
let screenStream = null;

/* Lấy ICE servers trên server tự turn */
async function getIceServers() {
  try {
    console.log("Bắt đầu lấy ICE servers...");

    const iceServers = [
      {
        urls: "stun:172.18.254.133:3478",
      },
      {
        urls: "turn:172.18.254.133:3478",
        username: "turnuser",
        credential: "turnpassword",
      },
    ];

    console.log("ICE servers được lấy thành công:", iceServers);
    return iceServers;
  } catch (error) {
    console.error("Lỗi khi lấy ICE servers:", error);
    const fallbackIceServers = [{ urls: "stun:stun.l.google.com:19302" }];
    console.log("Trả về ICE servers dự phòng:", fallbackIceServers);
    return fallbackIceServers;
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

    // Sự kiện click cho nút tham gia phòng
    $("#btnJoinRoom").click(() => {
      const username = $("#txtUsername").val();
      const roomId = $("#txtRoomId").val();

      // Kiểm tra dữ liệu đầu vào
      if (!username || !username.trim() || !roomId || !roomId.trim()) {
        return alert("Vui lòng nhập đầy đủ thông tin!");
      }

      // Kiểm tra nếu người dùng đã ở trong phòng
      if (currentRoomId) {
        return alert(
          "Bạn đang ở trong một phòng. Vui lòng rời phòng hiện tại trước khi tham gia phòng mới!"
        );
      }

      // Kiểm tra xem peer.id đã sẵn sàng chưa
      if (!peer.id) {
        return alert(
          "Đang kết nối tới server PeerJS, vui lòng thử lại sau giây lát!"
        );
      }

      // Kiểm tra xem phòng đã tồn tại chưa
      socket.emit("CHECK_ROOM_EXIST", roomId, (roomExists) => {
        if (roomExists) {
          // Phòng đã tồn tại, tham gia phòng
          socket.emit("JOIN_ROOM", { username, peerID: peer.id, roomId });
        } else {
          // Phòng chưa tồn tại, hỏi người dùng có muốn tạo phòng mới không
          if (
            confirm("Phòng này không tồn tại. Bạn có muốn tạo phòng mới không?")
          ) {
            // Tạo phòng mới
            socket.emit("CREATE_ROOM", roomId, (success) => {
              if (success) {
                // Sau khi tạo phòng thành công, tham gia phòng
                socket.emit("JOIN_ROOM", { username, peerID: peer.id, roomId });
              } else {
                alert(
                  "Lỗi khi tạo phòng. Phòng đã được tạo bởi người khác. Vui lòng thử lại."
                );
              }
            });
          }
        }
      });
    });
  });

  peer.on("call", (call) => {
    
    if (peers[call.peer]) {
      console.log("Call already exists with", call.peer);
      call.close();
      return;
    }

    const answerStream =
      isSharingScreen && screenStream ? screenStream : localStream;

    if (!answerStream) {
      openStream()
        .then((stream) => {
          localStream = stream;
          call.answer(stream);
          playStream("localStream", stream);

          // Lắng nghe ICE candidate khi trả lời
          call.on("icecandidate", (event) => {
            if (event.candidate) {
              console.log("Gửi ICE candidate tới:", call.peer, event.candidate);
              socket.emit("RELAY_ICE", {
                peerId: call.peer,
                candidate: event.candidate,
              });
            }
          });

          call.on("stream", (remoteStream) => {
            createRemoteVideo(call.peer);
            playStream(`remoteStream-${call.peer}`, remoteStream);
          });

          call.on("close", () => {
            removeRemoteVideo(call.peer);
            delete peers[call.peer];
          });

          peers[call.peer] = call;
        })
        .catch((error) => {
          console.error("Lỗi khi trả lời cuộc gọi:", error);
        });
    } else {
      call.answer(answerStream);
      playStream("localStream", answerStream);

      // Lắng nghe ICE candidate khi trả lời
      call.on("icecandidate", (event) => {
        if (event.candidate) {
          console.log("Gửi ICE candidate tới:", call.peer, event.candidate);
          socket.emit("RELAY_ICE", {
            peerId: call.peer,
            candidate: event.candidate,
          });
        }
      });

      call.on("stream", (remoteStream) => {
        createRemoteVideo(call.peer);
        playStream(`remoteStream-${call.peer}`, remoteStream);
      });

      call.on("close", () => {
        removeRemoteVideo(call.peer);
        delete peers[call.peer];
      });

      peers[call.peer] = call;
    }
  });
}

$("#div-chat").hide(); // Ẩn div-chat ở đầu

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

socket.on("connect", () => {
  console.log("Đã kết nối với server!");
  statusElement.textContent = "Kết nối đến máy chủ thành công!";
  statusElement.style.color = "blue";
});

socket.on("disconnect", () => {
  console.log("Mất kết nối với server!");
  statusElement.textContent = "Mất kết nối với server...";
  statusElement.style.color = "red";
});

socket.on("ROOM_USER_LIST", (data) => {
  const { users, currentPeerID } = data;
  const username = $("#txtUsername").val();
  const roomId = $("#txtRoomId").val();

  currentRoomId = roomId;
  userRoomsClient[roomId] = users;

  $("#div-chat").show();
  $("#div-signup").hide();

  $("#room-info").text(`Đây là phòng có id là: ${roomId}`);
  $("#user-info").text(`Chào bạn: ${username}`);

  $("#ulUser").empty();
  users.forEach((user) => {
    if (user.peerID != currentPeerID) {
      addNewUser(user);
    }
  });

  // Yêu cầu server gửi trạng thái chia sẻ màn hình của tất cả người dùng
  socket.emit("REQUEST_SHARE_SCREEN_STATUS", roomId);

  // Tạo đường link để chia sẻ
  const serverUrl = "http://localhost:3000";
  const inviteLink = `${serverUrl}/join?roomId=${roomId}&username=${randomString(
    8
  )}`;

  // Xóa invite-link-container cũ nếu tồn tại
  const oldLinkContainer = document.getElementById("invite-link-container");
  if (oldLinkContainer) {
    oldLinkContainer.remove();
  }

  // Tạo mới invite-link-container
  const linkContainer = document.createElement("div");
  linkContainer.id = "invite-link-container";
  linkContainer.innerHTML = `
    <p>Chia sẻ đường link để mời người khác tham gia phòng:</p>
    <input type="text" value="${inviteLink}" readonly style="width: 100%; padding: 5px; margin-bottom: 5px;">
    <button onclick="copyInviteLink()" style="padding: 5px 10px; background-color: #007bff; color: white; border: none; border-radius: 5px; cursor: pointer;">Sao chép</button>
  `;
  document.getElementById("div-chat").prepend(linkContainer);
});

socket.on("JOIN_ROOM_FAILED", (reason) => {
  alert(reason);
  window.location.href = "./";
  // Hiển thị lại giao diện đăng ký nếu tham gia thất bại
  $("#div-chat").hide();
  $("#div-signup").show();
  // Xóa các giá trị trong form
  $("#txtRoomId").val("");
  $("#txtUsername").val("");
});

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
      // Khi camera tắt, không cần làm tối, vì stream đã được thay bằng canvas trống
      videoElement.style.filter = "none"; // Xóa hiệu ứng làm tối
    } else {
      videoElement.style.filter = "brightness(1)"; // Khôi phục giao diện bình thường
    }
  }
});

socket.on("NEW_MESSAGE", ({ username, message, time }) => {
  console.log("📥 New message received:", { username, message, time });

  const chatBox = document.getElementById("chat-box");
  const isSelf = username === $("#txtUsername").val();

  const messageHTML = `
    <div class="message ${isSelf ? "right" : "left"}">
      <img src="https://cellphones.com.vn/sforum/wp-content/uploads/2024/02/avatar-anh-meo-cute-13.jpg" class="avatar">
      <div class="message-content">
        <p class="message-username">${username}</p>
       <p class="message-time">${time}</p>
      
        <p class="message-text">${message}</p>
      </div>
    </div>`;

  chatBox.innerHTML += messageHTML;
  chatBox.scrollTop = chatBox.scrollHeight;
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
  let video = document.getElementById(idVideoTag);
  if (!video) {
    console.warn(
      `Không tìm thấy phần tử video với id: ${idVideoTag}. Tạo mới...`
    );
    if (idVideoTag === "localStream") {
      // Tạo lại phần tử video cục bộ
      video = document.createElement("video");
      video.id = "localStream";
      video.autoplay = true;
      video.playsInline = true;
      video.muted = true; // Video cục bộ thường được mute để tránh phản hồi âm thanh
      video.classList.add("video-peer");

      // Thêm video vào giao diện
      const localVideoContainer = document.createElement("div");
      localVideoContainer.className = "video-wrapper";
      localVideoContainer.appendChild(video);

      // Thêm vào khu vực remoteStreams (hoặc một khu vực riêng cho localStream)
      const remoteStreams = document.getElementById("remoteStreams");
      remoteStreams.insertBefore(localVideoContainer, remoteStreams.firstChild); // Đặt video cục bộ lên đầu
    } else {
      console.error(`Không tìm thấy phần tử video với id: ${idVideoTag}`);
      return;
    }
  }

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


let isCameraOn = true; // Biến để theo dõi trạng thái camera

async function toggleCamera() {
  if (!localStream) return;
  isCameraOn = !isCameraOn; // Đảo ngược trạng thái ca
  if (isCameraOn) {
    // Bật camera
    try {
      // Lấy stream mới từ camera
      const newStream = await navigator.mediaDevices.getUserMedia({
        video: true,
      });
      const newVideoTrack = newStream.getVideoTracks()[0];

      // Xóa track trống (canvas) khỏi localStream
      const currentVideoTracks = localStream.getVideoTracks();
      currentVideoTracks.forEach((track) => {
        localStream.removeTrack(track);
        track.stop(); // Dừng track trống
      });

      // Thêm track video mới vào localStream
      localStream.addTrack(newVideoTrack);

      // Cập nhật giao diện cục bộ
      playStream("localStream", localStream);

      // Cập nhật track cho tất cả các peer
      Object.values(peers).forEach((call) => {
        const sender = call.peerConnection
          .getSenders()
          .find((s) => s.track && s.track.kind === "video");
        if (sender) {
          sender.replaceTrack(newVideoTrack);
        }
      });

      // Cập nhật nút và gửi sự kiện
      document.getElementById("toggleCam").innerText = "Tắt Camera";
      socket.emit("TOGGLE_CAMERA", { peerID: peer.id, isEnabled: true });
      console.log("Camera bật");
    } catch (err) {
      console.error("Lỗi khi bật lại camera:", err);
      alert("Không thể bật camera. Vui lòng kiểm tra quyền truy cập!");
      isCameraOn = false; // Đặt lại trạng thái nếu lỗi
      document.getElementById("toggleCam").innerText = "Bật Camera";
    }
  } else {
    // Tắt camera
    // Dừng track video hiện tại
    const videoTracks = localStream.getVideoTracks();
    videoTracks.forEach((track) => {
      localStream.removeTrack(track);
      track.stop();
    });
    console.log("Camera tắt");

    // Tạo một canvas trống để thay thế
    const canvas = document.createElement("canvas");
    canvas.width = 640;
    canvas.height = 480;
    const ctx = canvas.getContext("2d");
    ctx.fillStyle = "black";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = "white";
    ctx.font = "30px Arial";
    ctx.fillText("Camera Off", canvas.width / 2 - 80, canvas.height / 2);

    const blankStream = canvas.captureStream();
    const blankVideoTrack = blankStream.getVideoTracks()[0];
    localStream.addTrack(blankVideoTrack);

    // Cập nhật giao diện cục bộ
    playStream("localStream", localStream);

    // Cập nhật track cho tất cả các peer
    Object.values(peers).forEach((call) => {
      const sender = call.peerConnection
        .getSenders()
        .find((s) => s.track && s.track.kind === "video");
      if (sender) {
        sender.replaceTrack(blankVideoTrack);
      }
    });
    // Cập nhật nút và gửi sự kiện
    document.getElementById("toggleCam").innerText = "Bật Camera";
    socket.emit("TOGGLE_CAMERA", { peerID: peer.id, isEnabled: false });
  }
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

/***************************************************************************************************************/

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

// Hàm kết thúc cuộc gọi (rời phòng)
function endCall(peerId) {
  if (peers[peerId]) {
    peers[peerId].close();
    delete peers[peerId];
  }
  removeRemoteVideo(peerId);
}

// // Sự kiện click cho nút kết thúc cuộc gọi, đóng tất cả các kết nối WebRTC
// $("#btnEndCall").click(() => {
//   for (let peerId in peers)
//     endCall(peerId);
//   }
// });

// Hàm xóa phần tử khi có người dùng rời phòng
function removeInviteLink() {
  const container = document.getElementById("invite-link-container");
  if (container) {
    container.remove(); // Xóa phần tử
  }
}
//Hàm coppy link
function copyInviteLink() {
  const linkInput = document.querySelector("#invite-link-container input");
  linkInput.select();
  document.execCommand("copy");
  alert("Đã sao chép đường link!");
}

//Hàm random ký tự ngẫu nhiên A-Z a-z 0-9
function randomString(length) {
  let result = "";
  const characters =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  const charactersLength = characters.length;
  for (let i = 0; i < length; i++) {
    result += characters.charAt(Math.floor(Math.random() * charactersLength));
  }
  return result;
}

// Hàm đọc tham số từ URL
function getQueryParams() {
  const params = new URLSearchParams(window.location.search);
  return {
    roomId: params.get("roomId"),
    username: params.get("username") || randomString(8), // Nếu không có username, tạo ngẫu nhiên
  };
}

// Khi trang được tải, kiểm tra tham số từ URL và tự động tham gia phòng
document.addEventListener("DOMContentLoaded", () => {
  const { roomId, username } = getQueryParams();

  if (roomId && username) {
    // Điền sẵn thông tin vào form
    $("#txtRoomId").val(roomId);
    $("#txtUsername").val(username);

    // Hiển thị giao diện phòng ngay lập tức (trong khi chờ tham gia)
    $("#div-signup").hide();
    $("#div-chat").show();

    // Tự động tham gia phòng
    if (peer && peer.id) {
      // Nếu peer đã sẵn sàng, gửi JOIN_ROOM ngay lập tức
      socket.emit("JOIN_ROOM", { username, peerID: peer.id, roomId });
    } else {
      // Nếu peer chưa sẵn sàng, chờ peer mở rồi tham gia
      getIceServers().then((iceServers) => {
        peer = new Peer(undefined, { config: { iceServers } });
        setupPeerEvents();

        peer.on("open", (id) => {
          socket.emit("JOIN_ROOM", { username, peerID: id, roomId });
        });
      });
    }
  }
});

// Sự kiện click cho nút kết thúc cuộc gọi, Rời khỏi phòng
$("#btnEndCall").click(() => {
  // Hiển thị hộp thoại xác nhận
  const confirmEnd = confirm("Bạn có chắc chắn muốn kết thúc cuộc gọi không?");
  if (confirmEnd) {
    // Thông báo cho server rằng người dùng rời phòng
    socket.emit("LEAVE_ROOM", { peerID: peer.id, roomId: currentRoomId });

    // Kết thúc tất cả các cuộc gọi
    for (let peerId in peers) {
      endCall(peerId);
    }

    // Đưa về giao diện form nhập tên và phòng
    $("#div-chat").hide();
    $("#div-signup").show();

    // Xóa giá trị trong các ô nhập
    $("#txtUsername").val("");
    $("#txtRoomId").val("");

    // Xóa thông tin phòng và người dùng trên giao diện
    $("#room-info").text("");
    $("#user-info").text("");
    $("#ulUser").empty();

    // Xóa các video remote
    const videoContainer = document.getElementById("remoteStreams");
    while (videoContainer.firstChild) {
      videoContainer.removeChild(videoContainer.firstChild);
    }

    // Xóa video cục bộ
    const localVideo = document.getElementById("localStream");
    if (localVideo) {
      localVideo.parentElement.remove(); // Xóa cả video-wrapper chứa localStream
    }

    // Dừng stream cục bộ
    if (localStream) {
      localStream.getTracks().forEach((track) => track.stop());
      localStream = null;
    }
    removeInviteLink();
    // Xóa thông tin phòng hiện tại
    currentRoomId = "";
    userRoomsClient = {};
    // window.location.href = "http://localhost:3000";
    window.location.href = "./";
  }
});

// Hàm gọi tới một peer cụ thể
function callToPeer(peerId, stream) {
  if (peers[peerId]) {
    console.log("Đã tồn tại kết nối đến:", peerId);
    return;
  }

  console.log("Gọi đến peer:", peerId);

  // Sử dụng screenStream nếu đang chia sẻ, nếu không dùng stream mặc định
  let callStream = isSharingScreen && screenStream ? screenStream : stream;

  const call = peer.call(peerId, callStream);

  // Lắng nghe sự kiện ICE candidate từ PeerJS
  call.on("icecandidate", (event) => {
    if (event.candidate) {
      console.log("Gửi ICE candidate tới:", peerId, event.candidate);
      socket.emit("RELAY_ICE", { peerId, candidate: event.candidate });
    }
  });

  // SDP đã được gửi tự động qua PeerJS,có thể gửi thủ công nếu cần
  // call.on("signal", (data) => {
  //   console.log("Gửi SDP tới:", peerId, data);
  //   socket.emit("RELAY_SDP", { peerId, sdp: data });
  // });

  call.on("stream", (remoteStream) => {
    createRemoteVideo(peerId);
    playStream(`remoteStream-${peerId}`, remoteStream);
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

// Hàm tạo video remote
function createRemoteVideo(peerId) {
  if (document.getElementById(`remoteStream-${peerId}`)) return; // Tránh tạo trùng video

  const user = userRoomsClient[currentRoomId]?.find((u) => u.peerID === peerId);
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

  // Thêm nút Full Screen
  const controls = document.createElement("div");
  controls.className = "video-controls";

  const fullScreenBtn = document.createElement("button");
  fullScreenBtn.innerText = "Full Screen";
  fullScreenBtn.className = "control-btn fullscreen-btn";
  fullScreenBtn.onclick = () => toggleFullScreen(peerId);

  controls.appendChild(fullScreenBtn);

  // Thêm video, tên, và nút điều khiển vào wrapper
  const wrapper = document.createElement("div");
  wrapper.classList.add("video-wrapper");
  wrapper.id = `video-wrapper-${peerId}`; // Thêm id để dễ quản lý
  wrapper.appendChild(newVideo);
  wrapper.appendChild(nameTag);
  wrapper.appendChild(controls);

  videoContainer.appendChild(wrapper);
}

//Hàm chuyển đổi trạnng thái
function toggleFullScreen(peerId) {
  const video = document.getElementById(`remoteStream-${peerId}`);
  const fullScreenBtn = document.querySelector(
    `#video-wrapper-${peerId} .fullscreen-btn`
  );
  if (!video || !fullScreenBtn) return;

  if (!document.fullscreenElement) {
    video.requestFullscreen().catch((err) => {
      console.error("Lỗi khi vào chế độ toàn màn hình:", err);
    });
    fullScreenBtn.innerText = "Exit Full Screen";
  } else {
    document.exitFullscreen().catch((err) => {
      console.error("Lỗi khi thoát chế độ toàn màn hình:", err);
    });
    fullScreenBtn.innerText = "Full Screen";
  }
}

// Lắng nghe sự kiện thay đổi trạng thái toàn màn hình
document.addEventListener("fullscreenchange", () => {
  const fullScreenBtn = document.querySelector(".fullscreen-btn");
  if (fullScreenBtn) {
    fullScreenBtn.innerText = document.fullscreenElement
      ? "Exit Full Screen"
      : "Full Screen";
  }
});

// Sửa hàm removeRemoteVideo
function removeRemoteVideo(peerId) {
  const videoWrapper = document.getElementById(`video-wrapper-${peerId}`);
  if (videoWrapper) {
    videoWrapper.remove();
  }
}

// Sự kiện click cho nút tham gia cuộc gọi
$("#join-call").click(() => {
  if (!currentRoomId || !userRoomsClient[currentRoomId]) {
    return alert("Bạn cần tham gia một phòng trước!");
  }

  // Đảm bảo stream gửi đi phản ánh trạng thái hiện tại
  const callStream =
    isSharingScreen && screenStream ? screenStream : localStream;

  if (!callStream) {
    openStream()
      .then((stream) => {
        localStream = stream; // Gán lại localStream
        playStream("localStream", localStream); // Cập nhật giao diện cục bộ
        userRoomsClient[currentRoomId].forEach((user) => {
          if (user.peerID !== peer.id) {
            callToPeer(user.peerID, stream);
          }
        });
      })
      .catch((error) => {
        console.error("Lỗi khi mở stream:", error);
        alert(
          "Không thể truy cập camera/mic. Vui lòng kiểm tra quyền truy cập!"
        );
      });
  } else {
    // Cập nhật giao diện cục bộ trước khi gọi
    playStream("localStream", callStream);
    userRoomsClient[currentRoomId].forEach((user) => {
      if (user.peerID !== peer.id) {
        callToPeer(user.peerID, callStream);
      }
    });
  }
});

/*********************** Chia sẻ màn hình ************************/
let isSharingScreen = false; // Biến theo dõi trạng thái chia sẻ màn hình
const shareButton = document.getElementById("shareScreen");
let currentScreenTrack = null; // Lưu track màn hình để kiểm soát

shareButton.addEventListener("click", async () => {
  if (!isSharingScreen) {
    await startScreenShare();
  } else {
    stopScreenShare();
  }
});

async function startScreenShare() {
  try {
    if (isSharingScreen) return;

    const screenStreamTemp = await navigator.mediaDevices.getDisplayMedia({
      video: true,
    });
    const videoTrack = screenStreamTemp.getVideoTracks()[0];

    isSharingScreen = true;
    screenStream = screenStreamTemp; // Lưu stream màn hình
    currentScreenTrack = videoTrack;

    // Thay track cho các peer hiện tại
    Object.values(peers).forEach((call) => {
      const sender = call.peerConnection
        .getSenders()
        .find((s) => s.track.kind === "video");
      if (sender) sender.replaceTrack(videoTrack);
    });

    // Cập nhật localStream
    if (localStream) {
      const oldVideoTrack = localStream.getVideoTracks()[0];
      if (oldVideoTrack) {
        localStream.removeTrack(oldVideoTrack);
        oldVideoTrack.stop();
      }
      localStream.addTrack(videoTrack);
    } else {
      localStream = screenStreamTemp;
    }

    playStream("localStream", localStream); // Cập nhật giao diện cục bộ
    document.getElementById("localStream").style.border = "5px solid red";
    shareButton.textContent = "Dừng chia sẻ";

    videoTrack.onended = () => {
      if (isSharingScreen) stopScreenShare();
    };

    socket.emit("SHARE_SCREEN", { peerID: peer.id, isSharing: true });
  } catch (err) {
    console.error("Lỗi chia sẻ màn hình:", err);
    isSharingScreen = false; // Đặt lại trạng thái nếu lỗi
    screenStream = null;
  }
}

async function stopScreenShare() {
  if (!isSharingScreen) return;
  isSharingScreen = false;

  if (currentScreenTrack) {
    currentScreenTrack.stop();
    currentScreenTrack = null;
  }
  screenStream = null;

  // Dừng track video cũ trong localStream nếu có
  if (localStream) {
    const oldVideoTrack = localStream.getVideoTracks()[0];
    if (oldVideoTrack) {
      localStream.removeTrack(oldVideoTrack);
      oldVideoTrack.stop();
    }
  }

  const camStream = await openStream();
  const camTrack = camStream.getVideoTracks()[0];

  // Thay track cho các peer hiện tại
  Object.values(peers).forEach((call) => {
    const sender = call.peerConnection
      .getSenders()
      .find((s) => s.track.kind === "video");
    if (sender) sender.replaceTrack(camTrack);
  });

  // Cập nhật lại localStream
  localStream = camStream;

  playStream("localStream", localStream); // Cập nhật giao diện cục bộ
  document.getElementById("localStream").style.border = "none";
  shareButton.textContent = "Chia sẻ màn hình";

  socket.emit("SHARE_SCREEN", { peerID: peer.id, isSharing: false });
}

/*********************** End chia sẻ màn hình ************************/
// Hiển thị tên khi di chuột vào
function showUsername(event) {
  const video = event.target;
  const wrapper = video.parentElement;
  const nameTag = wrapper.querySelector(".video-username");
  nameTag.style.opacity = "1";
}
// Ẩn tên khi rời chuột
function hideUsername(event) {
  const video = event.target;
  const wrapper = video.parentElement;
  const nameTag = wrapper.querySelector(".video-username");
  nameTag.style.opacity = "0";
}
/******************************** Chat *****************************/

document.getElementById("send-chat").addEventListener("click", sendMessage);
document.getElementById("chat-input").addEventListener("keypress", (e) => {
  if (e.key === "Enter") sendMessage();
});

function sendMessage() {
  const message = document.getElementById("chat-input").value.trim();
  if (!message) return;

  const username = $("#txtUsername").val() || "Guest";
  const time = new Date().toLocaleTimeString();

  console.log("📤 Sending message:", {
    roomId: currentRoomId,
    message,
    username,
    time,
  });

  socket.emit("SEND_MESSAGE", {
    roomId: currentRoomId,
    message,
    username,
    time,
  });

  document.getElementById("chat-input").value = "";
}
