FROM python:3.12-slim

WORKDIR /app

# requirements 먼저 복사 → pip install 레이어 캐시 활용
# (코드만 변경 시 재빌드 불필요)
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# entrypoint는 /app 외부에 배치
# (./backend:/app 볼륨 마운트에 덮어씌워지지 않도록)
COPY entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

# 소스 코드 복사 (개발 환경에서는 볼륨 마운트로 덮어씌워짐)
COPY . .

EXPOSE 8000

ENTRYPOINT ["/entrypoint.sh"]
