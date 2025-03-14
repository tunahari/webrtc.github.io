# Sử dụng image Node.js làm base image
FROM node:18-alpine

# Tạo thư mục làm việc trong container
WORKDIR /app

# Sao chép package.json và package-lock.json
COPY server/package*.json ./

# Cài đặt các dependencies
RUN npm install

# Sao chép toàn bộ source code của dự án vào container
COPY . .

# Mở port 3000 (cổng ứng dụng chạy)
EXPOSE 3000

# Lấy IP công cộng từ máy chủ (thay đổi lệnh này cho phù hợp với hệ điều hành máy chủ của bạn)
ARG EXTERNAL_IP
ENV EXTERNAL_IP=${EXTERNAL_IP}

# Lệnh chạy ứng dụng
CMD ["npm", "start"]