const socket = io("http://localhost:3000");
// const socket = io("https://3000-tunahari-webrtcgithubio-5y4u2ynx3zf.ws-us118.gitpod.io/"); // comment khi deploy

let peer;
let peerConnection;
let localStream;
let currentCall; // Lưu trữ cuộc gọi hiện tại
const statusElement = document.querySelector(".status"); // Lấy tham chiếu đến phần tử status

async function getIceServers() {
  try {
    const response = await fetch("http://localhost:3000/getIceServers"); // comment khi deploy
    // const response = await fetch("https://3000-tunahari-webrtcgithubio-5y4u2ynx3zf.ws-us118.gitpod.io/getIceServers"); // comment khi chạy local
    const data = await response.json();
    return data.v.iceServers;
  } catch (error) {
    console.error("Lỗi lấy ICE servers:", error);
    return [{ urls: "stun:stun.l.google.com:19302" }];
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
    $("#btnSignUp").click(() => {
      const username = $("#txtUsername").val();
      socket.emit("NGUOI_DUNG_DANG_KY", { ten: username, peerID: id });
    });
  });

  peer.on("call", (call) => {
    currentCall = call; // Lưu trữ cuộc gọi khi có cuộc gọi đến
    openStream().then((stream) => {
      call.answer(stream);
      playStream("localStream", stream);
      call.on("stream", (remoteStream) =>
        playStream("remoteStream", remoteStream)
      );
      //Xử lý khi cuộc gọi bị đóng
      call.on('close', () => {
            console.log('Cuộc gọi đã kết thúc.');
            endCall();
        });
    });
  });
}

$("#div-chat").hide();

socket.on("List_Nguoi_Dung_Online", (arrUserInfo) => {
  $("#div-chat").show();
  $("#div-signup").hide();
  arrUserInfo.forEach((user) => {
    const { ten, peerID } = user;
    $("#ulUser").append(`<li id="${peerID}">✅ ${ten}</li>`);
  });

  socket.on("Have_New_User", (user) => {
    const { ten, peerID } = user;
    $("#ulUser").append(`<li id="${peerID}"> ${ten}</li>`);
  });

  socket.on("USER_DISCONNECT", (peerID) => {
    $(`#${peerID}`).remove();
  });
});

socket.on("DANG_KY_THAT_BAI", () =>
  alert("Username đã tồn tại. Vui lòng nhập username khác!")
);

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

function toggleCamera() {
  if (localStream) {
    let videoTracks = localStream.getVideoTracks();
    videoTracks.forEach((track) => (track.enabled = !track.enabled));
    document.getElementById("toggleCam").innerText = videoTracks[0].enabled
      ? "Tắt Camera"
      : "Bật Camera";
    console.log(
      `Camera ${
        videoTracks[0].enabled ? "enabled (Đã Bật)" : "disabled (Đã Tắt)"
      }`
    );
  }
}

function toggleMute() {
  let videoElement = document.getElementById("localStream");
  videoElement.muted = !videoElement.muted;
  document.getElementById("muteButton").innerText = videoElement.muted
    ? "Bật Âm Thanh"
    : "Tắt Âm Thanh";
  console.log(`Audio ${videoElement.muted ? "muted (Đã Câm )" : "unmuted (Hết Câm️)"}`);
}

$("#btnCall").click(() => {
    const id = $("#remoteID").val();
    callToPeer(id);
});

document.getElementById('toggleMic').addEventListener('click', toggleMic);
document.getElementById('toggleCam').addEventListener('click', toggleCamera);
document.getElementById('muteButton').addEventListener('click', toggleMute);

window.onload = openStream;

$("#ulUser").on("click", "li", function () {
  const id = $(this).attr("id");
  var tenhienthi = document.getElementById(id).textContent;
  var inputtext = document.getElementById("remoteID").value;
  console.log("id của", tenhienthi, "là:", id);
  if (id == peer.id || inputtext == peer.id)
    return alert("Không thực hiện được cuộc gọi đến chính mình!");
    callToPeer(id)
});

socket.on("connect", () => {
    console.log("Đã kết nối với server!");
    statusElement.textContent = "Kết nối đến máy chủ thành công!"; // Thay đổi nội dung khi kết nối thành công
    statusElement.style.color = "blue"; // Thay đổi màu sắc (tùy chọn)
});

// Hàm kết thúc cuộc gọi
function endCall() {
    if (currentCall) {
        currentCall.close();
        currentCall = null;
    }
    // Dừng luồng video của remote và tắt stream
    const remoteVideo = document.getElementById('remoteStream');
    if (remoteVideo.srcObject) {
        const tracks = remoteVideo.srcObject.getTracks();
        tracks.forEach(track => track.stop());
        remoteVideo.srcObject = null;
    }
    if(peerConnection){
        peerConnection.close();
        peerConnection = null
    }

    console.log("Đã kết thúc cuộc gọi!");
}
// Sự kiện click cho nút kết thúc cuộc gọi
$("#btnEndCall").click(() => {
    endCall();
});

// Hàm gọi tới một peer cụ thể
function callToPeer(peerId){
    openStream().then((stream) => {
        peerConnection = new RTCPeerConnection({ iceServers: peer.options.config.iceServers });
        stream.getTracks().forEach(track => peerConnection.addTrack(track, stream));
        peerConnection.onicecandidate = event => {
            console.log("ICE Candidate gửi:", event.candidate);
        };
        peerConnection.oniceconnectionstatechange = () => {
            console.log("ICE Connection State:", peerConnection.iceConnectionState);
        };
        currentCall = peer.call(peerId, stream);
        currentCall.on("stream", (remoteStream) => playStream("remoteStream", remoteStream));
        //Xử lý khi cuộc gọi bị đóng
        currentCall.on('close', () => {
            console.log('Cuộc gọi đã kết thúc.');
            endCall();
        });
    });
}

