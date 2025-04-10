********** Hướng dẫn chạy test trên local ******************
Yêu cầu có NodeJs và run "npm install"

** Bước 1: Tìm IP PUBLIC nội bộ
    -- Với Windown: 
    ------- Chạy cmd(terminal) nhập "ipconfig"
    ------- Tìm  IPv4 Address: ví dụ (192.168.2.15) đây là ip cần tìm.
    -- Với Linux
    ------- Chạy Ubuntu nhập "ip a"
    ------- Tìm inet trong (BROADCAST,MULTICAST,UP,LOWER_UP): ví dụ (172.18.254.133/20) thì ip cần tìm là: 172.18.254.133
** Bước 2: Config Coturn:
    -- Vào folder ./coturn/turnserver.conf
    -- Thay đổi allowed-peer-ip={IP nội bộ}
    ------- ví dụ: allowed-peer-ip=172.18.254.133
    -- Nếu chỉ chạy test local thì giữ nguyên external-ip và relay-ip: là 127.0.0.1
** Bước 3: Khởi chạy server.
    -- Chạy Docker Desktop
    -- Build mới compose docker bằng lệnh "docker compose up -d --build"
    -- Nhận thông báo như dưới là build thành công.
    ---------  ✔ Container coturn Started                                             
    ---------  ✔ Container server Started      
** Bước 4. Kiểm tra server   
    -- truy cập: https://webrtc.github.io/samples/src/content/peerconnection/trickle-ice/    
    -- Nhập thông tin vào:
    ------- STUN or TURN URI: turn:{Ip nội bộ}:{port}  ví dụ: turn:172.18.254.133:3478
    ------- TURN username: turnuser
    ------- TURN password: turnpassword
   // Xem các thông tin ip, turnuser, turnpassword, port... ở file ./coturn/turnserver.conf
    -- Nhấn vào Gather Candidats: 
    ------- Nếu relayProtocol trả về UDP hoặc TCP là thành công
** Bước 5: Chỉ thực hiện khi bước 4 mở đước Turn Server thành cônng;
    -- Vào file ./server/public/main.js tìm đến function getIceServers() (Line 12)
    -- Cấu hình cho stun và turn theo file ./coturn/turnserver.conf
    ------- Chỉ cấu hình ở urls: thay thế theo ip, port, username, password, theo turnserver.conf
** Mở public/index.html (nhận thông báo kết nối thành công) 
    -- F12 console theo dõi trạng thái xem có trả về đúng turn chưa, nếu trả về turn dự phòng thì phải xem lại cấu  hình turn và stun. Khi nào trả về turn 

****************** Hướng dẫn up lên VPS làm server ***************
Toàn bộ thao tác thực hiện trên máy ảo VPS
** Bước 1: Tìm IP PUBLIC của VPS    
    -- Truy cập: https://www.whatismyip.com/ và coppy My Public IPv4
    -- Ví dụ My Public IPv4: 104.28.160.165
** Bước 2: Config corturn:
    -- Thay thế toàn bộ external-ip, relay-ip và allowed-peer-ipp bằng Public IPv4 vừa tìm được
    -- Ví dụ:   external-ip=104.28.160.165
                relay-ip=104.28.160.165
                allowed-peer-ip=104.28.160.165
** Các bước còn lại làm tương tự như chạy test trên local
