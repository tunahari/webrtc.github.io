const socket = io("http://localhost:3000");
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

function openStream() {
  const config = { audio: true, video: true };
  return navigator.mediaDevices.getUserMedia(config);
}
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

//Caller
$("#btnCall").click(() => {
  const id = $("#remoteID").val();
  openStream().then((stream) => {
    playStream("localStream", stream);
    const call = peer.call(id, stream);
    call.on("stream", (remoteStream) =>
      playStream("remoteStream", remoteStream)
    );
  });
});

//Anssweler
peer.on("call", (call) => {
  openStream().then((stream) => {
    call.answer(stream);
    playStream("localStream", stream);
    call.on("stream", (remoteStream) =>
      playStream("remoteStream", remoteStream)
    );
  });
});

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
