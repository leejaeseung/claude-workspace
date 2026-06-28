# 로컬 실행 가이드 (WSL2 환경)

> Docker 없이 WSL2에서 OpenSearch 바이너리를 직접 실행하는 방법입니다.

---

## 환경 정보

| 항목 | 값 |
|------|-----|
| OS | Windows 11 + WSL2 (Ubuntu 22.04) |
| JDK | OpenJDK 21 (Adoptium Temurin) — `~/jdk/jdk-21.0.5+11` |
| OpenSearch | 2.19.0 바이너리 — `~/opensearch-local/opensearch-2.19.0` |
| 디스플레이 | WSLg (DISPLAY=:0) |

---

## 1회성 초기 설정

최초 1회만 진행합니다. 이미 완료된 경우 [2. 매번 실행](#2-매번-실행)으로 건너뜁니다.

### 1-1. JDK 21 설치

```bash
mkdir -p ~/jdk && cd ~/jdk
curl -L "https://github.com/adoptium/temurin21-binaries/releases/download/jdk-21.0.5%2B11/OpenJDK21U-jdk_x64_linux_hotspot_21.0.5_11.tar.gz" \
  -o jdk21.tar.gz
tar -xzf jdk21.tar.gz
# 설치 확인
~/jdk/jdk-21.0.5+11/bin/java -version
```

### 1-2. OpenSearch 2.19.0 설치

```bash
mkdir -p ~/opensearch-local && cd ~/opensearch-local
curl -L "https://artifacts.opensearch.org/releases/bundle/opensearch/2.19.0/opensearch-2.19.0-linux-x64.tar.gz" \
  -o opensearch.tar.gz
tar -xzf opensearch.tar.gz
```

### 1-3. OpenSearch 로컬 개발 설정

```bash
cat > ~/opensearch-local/opensearch-2.19.0/config/opensearch.yml << 'EOF'
cluster.name: local-test
node.name: local-node-1
discovery.type: single-node
network.host: 0.0.0.0
plugins.security.disabled: true
bootstrap.memory_lock: false
EOF

# JVM 힙 크기 조정 (로컬 개발용)
sed -i 's/-Xms[0-9]*[gGmM]/-Xms512m/' ~/opensearch-local/opensearch-2.19.0/config/jvm.options
sed -i 's/-Xmx[0-9]*[gGmM]/-Xmx512m/' ~/opensearch-local/opensearch-2.19.0/config/jvm.options
```

### 1-4. 한글 폰트 설치 (WSLg GUI 앱 필수)

```bash
mkdir -p ~/.local/share/fonts
cp /mnt/c/Windows/Fonts/malgun.ttf ~/.local/share/fonts/
cp /mnt/c/Windows/Fonts/malgunbd.ttf ~/.local/share/fonts/
fc-cache -f ~/.local/share/fonts/
# 확인
fc-list :lang=ko
```

---

## 2. 매번 실행

### 2-1. OpenSearch 시작

```bash
export JAVA_HOME=~/jdk/jdk-21.0.5+11
export OPENSEARCH_JAVA_HOME=$JAVA_HOME

nohup ~/opensearch-local/opensearch-2.19.0/bin/opensearch \
  > /tmp/opensearch.log 2>&1 &

echo "PID: $!"
```

기동 완료 확인 (green 또는 yellow 상태가 될 때까지 대기):

```bash
# 방법 1: 상태 직접 확인
curl http://localhost:9200/_cluster/health

# 방법 2: 기동될 때까지 대기 (최대 60초)
for i in $(seq 1 12); do
  STATUS=$(curl -s http://localhost:9200/_cluster/health 2>/dev/null \
    | python3 -c "import sys,json; print(json.load(sys.stdin).get('status','?'))" 2>/dev/null)
  [ "$STATUS" = "green" ] || [ "$STATUS" = "yellow" ] && echo "✅ 기동 완료" && break
  echo "⏳ 대기 중... ($i/12)"; sleep 5
done
```

### 2-2. 앱 실행

```bash
export JAVA_HOME=~/jdk/jdk-21.0.5+11
export PATH=$JAVA_HOME/bin:$PATH
export DISPLAY=:0

cd /mnt/c/Users/wasd2/claude-workspace/opensearch-client/app
./gradlew run
```

> **첫 실행 시**: Gradle 래퍼가 Gradle 8.11을 자동 다운로드합니다 (약 1~2분 소요).  
> **이후 실행**: 캐시가 있으므로 즉시 시작됩니다.

앱이 실행되면 Windows 데스크탑에 GUI 창이 나타납니다.

---

## 3. 샘플 데이터 삽입 (선택)

OpenSearch 기동 후 아래 스크립트로 테스트용 데이터 500건을 삽입합니다.

```bash
python3 << 'EOF'
import json, random, urllib.request, urllib.error
from datetime import datetime, timedelta

BASE = "http://localhost:9200"

CATEGORIES = ["전자제품", "의류", "식품", "도서", "스포츠", "가구", "뷰티", "생활용품"]
BRANDS     = ["삼성", "LG", "애플", "나이키", "아디다스", "이케아", "올리브영", "다이슨"]
CITIES     = ["서울", "부산", "인천", "대구", "광주", "대전", "울산", "수원", "고양", "창원"]
STATUSES   = ["주문완료", "배송중", "배송완료", "취소", "반품처리"]
NAMES      = ["김민준", "이서연", "박지훈", "최예린", "정하준", "강민서", "윤지아", "장현우",
              "임수진", "한도윤", "오재원", "서하은", "신민호", "권나연", "황준서"]
DOMAINS    = ["gmail.com", "naver.com", "kakao.com", "daum.net"]

def rand_date(days_back=365):
    return (datetime.now() - timedelta(days=random.randint(0, days_back))).strftime("%Y-%m-%dT%H:%M:%S")

def bulk(index, docs):
    lines = []
    for i, doc in enumerate(docs):
        lines.append(json.dumps({"index": {"_index": index, "_id": str(i+1)}}))
        lines.append(json.dumps(doc, ensure_ascii=False))
    body = "\n".join(lines) + "\n"
    req  = urllib.request.Request(f"{BASE}/_bulk", data=body.encode(),
                                  headers={"Content-Type": "application/x-ndjson"}, method="POST")
    with urllib.request.urlopen(req) as r:
        res = json.loads(r.read())
        print(f"  {index}: {len(docs)}건 (errors={res['errors']}, took={res['took']}ms)")

def put_mapping(name, props):
    try:
        urllib.request.urlopen(urllib.request.Request(
            f"{BASE}/{name}", data=json.dumps({"mappings":{"properties":props}}).encode(),
            headers={"Content-Type": "application/json"}, method="PUT"))
    except urllib.error.HTTPError:
        pass

# products (200건)
put_mapping("products", {
    "name": {"type":"text"}, "category": {"type":"keyword"}, "brand": {"type":"keyword"},
    "price": {"type":"integer"}, "stock": {"type":"integer"}, "rating": {"type":"float"},
    "created_at": {"type":"date"}, "is_active": {"type":"boolean"},
})
pnames = ["무선 이어폰","스마트워치","노트북 파우치","텀블러","운동화","후드티","청바지",
          "백팩","무선 마우스","기계식 키보드","공기청정기","전기밥솥","핸드크림","선크림",
          "비타민","요가 매트","덤벨 세트","책상 조명","필로우 쿠션","아이패드 케이스"]
bulk("products", [{"name": f"{random.choice(BRANDS)} {random.choice(pnames)} {random.randint(1,9)}세대",
    "category": random.choice(CATEGORIES), "brand": random.choice(BRANDS),
    "price": random.randint(5000, 500000), "stock": random.randint(0, 500),
    "rating": round(random.uniform(1.0, 5.0), 1), "created_at": rand_date(730),
    "is_active": random.choice([True, True, True, False])} for _ in range(200)])

# orders (200건)
put_mapping("orders", {
    "order_id": {"type":"keyword"}, "customer_name": {"type":"keyword"},
    "product_name": {"type":"text"}, "category": {"type":"keyword"},
    "quantity": {"type":"integer"}, "total_price": {"type":"integer"},
    "status": {"type":"keyword"}, "city": {"type":"keyword"}, "ordered_at": {"type":"date"},
})
bulk("orders", [{"order_id": f"ORD-2024-{i+1:05d}", "customer_name": random.choice(NAMES),
    "product_name": f"{random.choice(BRANDS)} {random.choice(['무선 이어폰','노트북','운동화','청바지','텀블러'])}",
    "category": random.choice(CATEGORIES), "quantity": (q:=random.randint(1,5)),
    "total_price": q * random.randint(5000, 300000),
    "status": random.choice(STATUSES), "city": random.choice(CITIES),
    "ordered_at": rand_date(180)} for i in range(200)])

# users (100건)
put_mapping("users", {
    "user_id": {"type":"keyword"}, "name": {"type":"keyword"}, "city": {"type":"keyword"},
    "age": {"type":"integer"}, "grade": {"type":"keyword"},
    "total_orders": {"type":"integer"}, "total_spent": {"type":"integer"},
    "joined_at": {"type":"date"}, "is_active": {"type":"boolean"},
})
bulk("users", [{"user_id": f"USR-{i+1:04d}", "name": (n:=random.choice(NAMES)),
    "email": f"{n.replace(' ','')}_{i+1}@{random.choice(DOMAINS)}",
    "city": random.choice(CITIES), "age": random.randint(18, 65),
    "grade": random.choice(["Bronze","Silver","Gold","Platinum"]),
    "total_orders": (o:=random.randint(0,50)), "total_spent": o * random.randint(10000, 100000),
    "joined_at": rand_date(1000), "is_active": random.choice([True, True, True, False])}
    for i in range(100)])

# 최종 확인
urllib.request.urlopen(f"{BASE}/_refresh")
print("\n인덱스별 건수:")
for idx in ["products","orders","users"]:
    with urllib.request.urlopen(f"{BASE}/{idx}/_count") as r:
        print(f"  {idx}: {json.loads(r.read())['count']}건")
EOF
```

**삽입 결과:**

| 인덱스 | 건수 | 주요 필드 |
|--------|------|-----------|
| `products` | 200건 | name, category, brand, price, stock, rating |
| `orders` | 200건 | order_id, customer_name, status, city, total_price |
| `users` | 100건 | user_id, name, grade, city, total_orders, total_spent |

---

## 4. 종료

### 앱 종료

앱 창의 X 버튼을 클릭하거나, 터미널에서:

```bash
pkill -f "MainKt"
```

### OpenSearch 종료

```bash
pkill -f "opensearch"
# 또는 PID로 종료
kill $(cat ~/opensearch-local/opensearch-2.19.0/opensearch-tar-install.pid 2>/dev/null)
```

---

## 5. 앱 사용법

### 검색 실행

1. **인덱스** 필드에 인덱스 이름 입력 (예: `products`, `orders`, `users`)
   - 돋보기 아이콘 클릭 시 사용 가능한 인덱스 드롭다운 표시
2. **키워드** 필드에 검색어 입력 (비워두면 전체 조회)
3. **필터** 필드에 `필드명 = 값` 형식으로 Term 필터 추가 (선택)
4. **정렬** 필드와 방향(DESC/ASC) 설정 (선택)
5. **검색** 버튼 클릭 또는 키워드 필드에서 `Enter`

### CSV 내보내기

1. 검색 결과 우측 상단 **컬럼 선택** 버튼으로 내보낼 필드 선택
2. **CSV** 버튼 클릭
3. 저장 위치: 파일 저장 다이얼로그에서 선택

### 프로파일 관리

- **상단 바**: `로컬 Docker` / `운영 서버` 버튼으로 환경 전환
- **⚙ 아이콘**: 현재 프로파일 편집 (호스트, 포트, 인증 정보 등)
- **+ 버튼**: 새 프로파일 추가

---

## 6. 트러블슈팅

### 한글이 박스(□)로 표시될 때

```bash
mkdir -p ~/.local/share/fonts
cp /mnt/c/Windows/Fonts/malgun.ttf ~/.local/share/fonts/
fc-cache -f ~/.local/share/fonts/
# 앱 재시작
```

### 앱 실행 후 "연결 실패" 메시지

OpenSearch가 기동 완료되기 전에 앱을 시작한 경우입니다.  
OpenSearch health가 green/yellow인 것을 확인한 뒤 앱을 재시작하세요.

```bash
curl http://localhost:9200/_cluster/health
# "status":"green" 또는 "yellow" 확인 후 앱 실행
```

### `DISPLAY` 환경 변수 오류

```bash
export DISPLAY=:0
# 또는 WSLg가 활성화되어 있는지 확인
ls /mnt/wslg/
```

### Gradle 빌드 오류 (`JVM target` 관련)

`build.gradle.kts`의 `kotlin { jvmToolchain(21) }` 설정과 JDK 21이 일치해야 합니다.  
`JAVA_HOME`이 올바르게 설정되어 있는지 확인하세요.

```bash
echo $JAVA_HOME
# 기대값: /home/<user>/jdk/jdk-21.0.5+11
```
