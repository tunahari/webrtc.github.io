# 📡 Hướng dẫn chạy test WebRTC local với Docker + Coturn

## ⚙️ Yêu cầu
- Cài đặt [Node.js](https://nodejs.org/)
- Chạy `npm install` trong thư mục `server/`

---

## 🧪 Bước 1: Tìm IP nội bộ (IP dùng để cấu hình TURN server)

### Trên Windows:
- bash(cmd): `ipconfig`

- Tìm `IPv4 Address`, ví dụ: `192.168.2.15`

### Trên Linux:
- bash(ubuntu): `ip a`

- Tìm `inet` trong phần chứa `BROADCAST, MULTICAST`, ví dụ: `172.18.254.133/20`
- Ip cần tìm là: `172.18.254.133`
---------------------------------------------

## 🛠️ Bước 2: Cấu hình Coturn

- Mở file: `.env`
- Thay đổi
     `ALLOWED_PEER_IP={IP nội bộ}`
    ví dụ: `ALLOWED_PEER_IP=192.168.x.x`  # (hoặc IP nội bộ bạn vừa tìm)

> ⚠️ Nếu chỉ test local, giữ nguyên `EXTERNAL_IP` và `RELAY_IP` là `127.0.0.1`

- ⚠️ Cổng của server và cổng của Turn là 2 cổng khác nhau
- ⚠️ Thay đổi cổng khác nếu cổng bị chặn trên thiết bị
---------------------------------------------

## 🚀 Bước 3: Khởi chạy server.
- Khởi chạy Docker Desktop (Aplication)
- Build mới compose docker
- bash: `docker compose up -d --build`

Nếu thành công, terminal sẽ báo:
```
✔ Container coturn Started
✔ Container server Started
```
- Cả 2 container phải ở trạng thái Started 

---------------------------------------------

## 🧪 Bước 4: Kiểm tra TURN server hoạt động

- Truy cập: [Trickle ICE](https://webrtc.github.io/samples/src/content/peerconnection/trickle-ice/) 

Nhập thông tin:

STUN or TURN URI: turn:<IP nội bộ>:<TURN_PORT>
TURN username: <TURN_USER>
TURN password: <TURN_PASSWORD>

👉 Thông tin này lấy trong `.env`

- Nhấn **Gather candidates**  
✅ Nếu bạn thấy dòng `relayProtocol` trả về: `udp` hoặc `tcp` thì TURN hoạt động thành công.


---------------------------------------------

## 🎬 Bước 5: Chạy thử giao diện

- Mở `public/index.html` trong trình duyệt và hiển thị `Kết nối đến máy chủ thành công!`
- Mở DevTools (F12) → tab Console  →  `ICE servers được lấy thành công:`
- Kiểm tra xem ICE server trả về đúng TURN chưa
- Nếu trả về turn dự phòng thì phải xem lại cấu hình turn.

---------------------------------------------

# ☁️ Hướng dẫn triển khai WebRTC trên VPS (Public IP)

## 🌍 Bước 1: Lấy Public IP của VPS

Truy cập: [whatismyip.com](https://www.whatismyip.com/) và coppy: My Public IPv4

Ví dụ:  My Public IPv4: 104.28.160.165

---------------------------------------------

## 🛠️ Bước 2: Sửa file `.env`

Thay thế toàn bộ EXTERNAL_IP, RELAY_IP và ALLOWED_PEER_IP bằng Public IPv4 vừa tìm được
```conf (ví dụ)
EXTERNAL_IP=104.28.160.165
RELAY_IP=104.28.160.165
ALLOWED_PEER_IP=104.28.160.165
```

> ⚠️ Đây là IP Public thật từ VPS
> ⚠️ VPS thường sẽ mở tất cả các cổng nên không cần thay đổi `SERVER_PORT` `SERVER_PORT` trong .env
---------------------------------------------

## Bước 3: 🚀 Các bước còn lại:
Thực hiện **giống như hướng dẫn local**, chỉ thay IP là IP public VPS.
