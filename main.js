const socket = io("http://localhost:3000"); //Đây tui chạy test trên Local. Chạy host thật thì comment dòng này lại mở coment cái dưới mà chạy
// const socket = io("https://3000-tunahari-webrtcgithubio-5y4u2ynx3zf.ws-us118.gitpod.io/"); Chạy hots miền nào điền vào miền đó.

//Cái này để ẩn cái khung chínhchính
$("#div-chat").hide();

//Nhận socket từ server
socket.on("List_Nguoi_Dung_Online", (arrUserInfo) => {
  $("#div-chat").show();
  $("#div-signup").hide();
  // console.log(arrUserInfo);
  arrUserInfo.forEach((user) => {
    const { ten, peerID } = user;
    $("#ulUser").append(`<li id="${peerID}">✅ ${ten}</li>`);
  });

  //Nhận socket tu server có người dùng mới "Have_New_User"
  socket.on("Have_New_User", (user) => {
    // console.log(user);
    const { ten, peerID } = user;
    $("#ulUser").append(`<li id="${peerID}">🔹 ${ten}</li>`);
  });
  //Nhận socket tu server "USER_DISCONNECT"
  socket.on("USER_DISCONNECT", (peerID) => {
    $(`#${peerID}`).remove();
  });
});

//Khi bên kia gửi "DANG_KY_THAT_BAI" thì bên này nhận
socket.on("DANG_KY_THAT_BAI", () =>
  alert("Usernamre đã tồn tại. Vui lý nhập username khác!")
);
////////////////Xử lý phím bấm media
let localStream;

// Mở stream từ camera và mic
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

// Phát stream lên thẻ video
function playStream(idVideoTag, stream) {
    const video = document.getElementById(idVideoTag);
    video.srcObject = stream;
    video.play();
}
// openStream().then((stream) => playStream("localStream", stream));

//Nhận ID từ peerr
const peer = new Peer();
// peer.on("open", id => $("#my-peer").html("Your Peer ID: " + id)); //Sửa toàn bộ nội dung HTML
peer.on("open", (id) => {
  $("#my-peer").append(id);
  $("#my-peer-id").append(id);
  $("#btnSignUp").click(() => {
    const username = $("#txtUsername").val();
    socket.emit("NGUOI_DUNG_DANG_KY", { ten: username, peerID: id });
    // console.log(username);
  });
});

// Xử lý bật/tắt micro
function toggleMic() {
    if (localStream) {
        let audioTracks = localStream.getAudioTracks();
        audioTracks.forEach(track => track.enabled = !track.enabled);
        document.getElementById('toggleMic').innerText = audioTracks[0].enabled ? 'Tắt Mic' : 'Bật Mic';
        console.log(`Microphone ${audioTracks[0].enabled ? 'enabled (Đã Bật)' : 'disabled (Đã Tắt)'}`);
    }
}

// Xử lý bật/tắt camera
function toggleCamera() {
    if (localStream) {
        let videoTracks = localStream.getVideoTracks();
        videoTracks.forEach(track => track.enabled = !track.enabled);
        document.getElementById('toggleCam').innerText = videoTracks[0].enabled ? 'Tắt Camera' : 'Bật Camera';
        console.log(`Camera ${videoTracks[0].enabled ? 'enabled (Đã Bật)' : 'disabled (Đã Tắt)'}`);
    }
}

// Xử lý bật/tắt âm thanh thiết bị
function toggleMute() {
    let videoElement = document.getElementById('localStream');
    videoElement.muted = !videoElement.muted;
    document.getElementById('muteButton').innerText = videoElement.muted ? 'Bật Âm Thanh' : 'Tắt Âm Thanh';
    console.log(`Audio ${videoElement.muted ? 'muted (Đã Câm 🤐)' : 'unmuted (Hết Câm🗣️)'}`);
}

// Caller
$("#btnCall").click(() => {
    const id = $("#remoteID").val();
    openStream().then((stream) => {
        const call = peer.call(id, stream);
        call.on("stream", (remoteStream) => playStream("remoteStream", remoteStream));
    });
});

// Answerer
peer.on("call", (call) => {
    openStream().then((stream) => {
        call.answer(stream);
        playStream("localStream", stream);
        call.on("stream", (remoteStream) => playStream("remoteStream", remoteStream));
    });
});

// Gán sự kiện cho button
document.getElementById('toggleMic').addEventListener('click', toggleMic);
document.getElementById('toggleCam').addEventListener('click', toggleCamera);
document.getElementById('muteButton').addEventListener('click', toggleMute);

// Khởi động media khi load trang
window.onload = openStream;


//Xử lý ấn vào tên để calling to úerr
$("#ulUser").on("click", "li", function () {
  const id = $(this).attr("id");
  var tenhienthi = document.getElementById(id).textContent;
  var inputtext = document.getElementById("remoteID").value;
  console.log("id của", tenhienthi, "là:", id);
  //Không được thực hiện hiện cuọc gọi cho chính mình
  if (id == peer.id || inputtext == peer.id) 
    return alert("Không thực hiện được cuộc gọi đến chính mình!");
  
  openStream().then((stream) => {
    playStream("localStream", stream);
    const call = peer.call(id, stream);
    call.on("stream", (remoteStream) =>
      playStream("remoteStream", remoteStream)
    );
  });
});




socket.on("connect", () => {
  console.log("Đã kết nối với server!");
});
