// const socket = io("http://localhost:3000"); //Đây tui chạy test trên Local. Chạy host thật thì comment dòng này lại mở coment cái dưới mà chạy
const socket = io("https://3000-tunahari-webrtcgithubio-5y4u2ynx3zf.ws-us118.gitpod.io/");

let peer;
let peerConnection;
let localStream;

async function getIceServers() {
    try {
      // const response = await fetch("http://localhost:3000/getIceServers"); 
        const response = await fetch("https://3000-tunahari-webrtcgithubio-5y4u2ynx3zf.ws-us118.gitpod.io/getIceServers");
        const data = await response.json();
        return data.v.iceServers;
    } catch (error) {
        console.error("Lỗi lấy ICE servers:", error);
        return [{ urls: "stun:stun.l.google.com:19302" }];
    }
}

getIceServers().then(iceServers => {
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
        openStream().then((stream) => {
            call.answer(stream);
            playStream("localStream", stream);
            call.on("stream", (remoteStream) => playStream("remoteStream", remoteStream));
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
        audioTracks.forEach(track => track.enabled = !track.enabled);
        document.getElementById('toggleMic').innerText = audioTracks[0].enabled ? 'Tắt Mic' : 'Bật Mic';
        console.log(`Microphone ${audioTracks[0].enabled ? 'enabled (Đã Bật)' : 'disabled (Đã Tắt)'}`);
    }
}

function toggleCamera() {
    if (localStream) {
        let videoTracks = localStream.getVideoTracks();
        videoTracks.forEach(track => track.enabled = !track.enabled);
        document.getElementById('toggleCam').innerText = videoTracks[0].enabled ? 'Tắt Camera' : 'Bật Camera';
        console.log(`Camera ${videoTracks[0].enabled ? 'enabled (Đã Bật)' : 'disabled (Đã Tắt)'}`);
    }
}

function toggleMute() {
    let videoElement = document.getElementById('localStream');
    videoElement.muted = !videoElement.muted;
    document.getElementById('muteButton').innerText = videoElement.muted ? 'Bật Âm Thanh' : 'Tắt Âm Thanh';
    console.log(`Audio ${videoElement.muted ? 'muted (Đã Câm )' : 'unmuted (Hết Câm️)'}`);
}

$("#btnCall").click(() => {
    const id = $("#remoteID").val();
    openStream().then((stream) => {
        peerConnection = new RTCPeerConnection({ iceServers: peer.options.config.iceServers });
        stream.getTracks().forEach(track => peerConnection.addTrack(track, stream));
        peerConnection.onicecandidate = event => {
            console.log("ICE Candidate gửi:", event.candidate);
        };
        peerConnection.oniceconnectionstatechange = () => {
            console.log("ICE Connection State:", peerConnection.iceConnectionState);
        };
        const call = peer.call(id, stream);
        call.on("stream", (remoteStream) => playStream("remoteStream", remoteStream));
    });
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
    openStream().then((stream) => {
        peerConnection = new RTCPeerConnection({ iceServers: peer.options.config.iceServers });
        stream.getTracks().forEach(track => peerConnection.addTrack(track, stream));
        peerConnection.onicecandidate = event => {
            console.log("ICE Candidate gửi:", event.candidate);
        };
        peerConnection.oniceconnectionstatechange = () => {
            console.log("ICE Connection State:", peerConnection.iceConnectionState);
        };
        const call = peer.call(id, stream);
        call.on("stream", (remoteStream) =>
            playStream("remoteStream", remoteStream)
        );
    });
});

socket.on("connect", () => {
    console.log("Đã kết nối với server!");
});