# coturn/Dockerfile
FROM coturn/coturn:4.6.2

# Cài đặt các công cụ cần thiết (nếu cần)
USER root
RUN apt-get update && apt-get install -y \
    net-tools \
    && rm -rf /var/lib/apt/lists/*

# Sao chép file cấu hình turnserver.conf vào container
COPY turnserver.conf /etc/coturn/turnserver.conf

# Mở cổng 3478 cho CoTURN
EXPOSE 3478/tcp 3478/udp

# Chạy CoTURN với tham số dòng lệnh, truyền biến môi trường
CMD ["turnserver", \
     "-c", "/etc/coturn/turnserver.conf", \
     "--user=${TURN_USER}:${TURN_PASSWORD}", \
     "--external-ip=${EXTERNAL_IP}", \
     "--relay-ip=${RELAY_IP}", \
     "--allowed-peer-ip=${ALLOWED_PEER_IP}", \
     "--allowed-peer-ip=0.0.0.0/0", \
     "--listening-ip=0.0.0.0", \
     "--listening-port=${TURN_PORT}", \
     "-v"]