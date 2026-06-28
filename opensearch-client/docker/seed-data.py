#!/usr/bin/env python3
"""
OpenSearch 샘플 데이터 시드 스크립트
- products: 200건
- orders:   200건
- users:    100건
합계 500건

매번 실행 시 기존 인덱스를 삭제하고 재생성합니다.
"""

import json
import random
import urllib.request
import urllib.error
from datetime import datetime, timedelta

BASE_URL = "http://localhost:9200"

KOREAN_LAST = ["김", "이", "박", "최", "정", "강", "조", "윤", "장", "임"]
KOREAN_FIRST = ["민준", "서연", "지우", "예준", "서현", "도윤", "지아", "하준", "지민", "수아",
                "준서", "지유", "주원", "채원", "지호", "은우", "수빈", "은서", "민서", "시우"]
CITIES = ["서울", "부산", "대구", "인천", "광주", "대전", "울산", "수원", "성남", "고양"]
EMAIL_DOMAINS = ["gmail.com", "naver.com", "kakao.com", "daum.net"]

PRODUCT_CATEGORIES = ["전자기기", "의류", "식품", "도서", "스포츠", "뷰티", "홈&리빙", "완구"]
BRANDS = ["삼성", "LG", "애플", "나이키", "아디다스", "유니클로", "이케아", "소니", "다이슨", "뉴발란스"]
ORDER_STATUSES = ["주문완료", "배송중", "배송완료", "취소", "반품"]
USER_GRADES = ["BRONZE", "SILVER", "GOLD", "PLATINUM", "VIP"]

PRODUCT_NAMES = {
    "전자기기": ["갤럭시 S24", "아이폰 15", "갤럭시 탭", "LG OLED TV", "다이슨 청소기",
                "소니 헤드폰", "에어팟 프로", "맥북 에어", "갤럭시 워치", "아이패드 프로"],
    "의류":    ["나이키 후드티", "유니클로 청바지", "아디다스 트레이닝복", "리바이스 셔츠", "폴로 니트",
                "H&M 원피스", "자라 코트", "빈폴 점퍼", "MLB 캡", "컨버스 청자켓"],
    "식품":    ["스타벅스 원두", "제주 감귤", "한우 등심", "유기농 쌀", "수입 올리브오일",
                "프리미엄 견과류", "명품 김치", "수제 잼 세트", "건강즙 세트", "프로틴 쉐이크"],
    "도서":    ["클린 코드", "자바스크립트 완벽 가이드", "파이썬 머신러닝", "알고리즘 입문",
                "사피엔스", "총균쇠", "미라클 모닝", "아주 작은 습관", "원칙", "1분 독서법"],
    "스포츠":  ["나이키 운동화", "아디다스 러닝화", "뉴발란스 워킹화", "요가 매트", "덤벨 세트",
                "헬스 밴드", "수영 고글", "자전거 헬멧", "등산 스틱", "테니스 라켓"],
    "뷰티":    ["설화수 자음수", "헤라 쿠션", "이니스프리 선크림", "라네즈 크림", "미샤 앰플",
                "롬앤 립틴트", "클리오 마스카라", "토리버치 향수", "조말론 향수", "에스티로더 세럼"],
    "홈&리빙": ["이케아 책상", "한샘 소파", "발뮤다 선풍기", "쿠쿠 밥솥", "테팔 프라이팬",
                "다이슨 공기청정기", "필립스 공기청정기", "위닉스 제습기", "에어워셔", "로봇청소기"],
    "완구":    ["레고 테크닉", "닌텐도 스위치", "플레이스테이션 5", "바비 인형", "트랜스포머",
                "마블 피규어", "드론 미니", "RC카", "블록 세트", "보드게임"],
}


def rand_name():
    return random.choice(KOREAN_LAST) + random.choice(KOREAN_FIRST)


def rand_date(days_back=365):
    base = datetime(2026, 1, 1)
    delta = timedelta(days=random.randint(0, days_back), seconds=random.randint(0, 86399))
    return (base + delta).strftime("%Y-%m-%dT%H:%M:%S")


def _req(method, path, body=None):
    url = BASE_URL + path
    data = json.dumps(body).encode() if body is not None else None
    headers = {"Content-Type": "application/json"}
    req = urllib.request.Request(url, data=data, headers=headers, method=method)
    with urllib.request.urlopen(req) as r:
        return json.loads(r.read())


MAPPINGS = {
    "products": {
        "mappings": {
            "properties": {
                "name":        {"type": "text"},
                "brand":       {"type": "keyword"},
                "category":    {"type": "keyword"},
                "price":       {"type": "integer"},
                "stock":       {"type": "integer"},
                "rating":      {"type": "float"},
                "is_active":   {"type": "boolean"},
                "description": {"type": "text"},
                "created_at":  {"type": "date"},
            }
        }
    },
    "users": {
        "mappings": {
            "properties": {
                "user_id":      {"type": "keyword"},
                "name":         {"type": "keyword"},
                "email":        {"type": "keyword"},
                "age":          {"type": "integer"},
                "city":         {"type": "keyword"},
                "grade":        {"type": "keyword"},
                "is_active":    {"type": "boolean"},
                "joined_at":    {"type": "date"},
                "total_orders": {"type": "integer"},
                "total_spent":  {"type": "integer"},
            }
        }
    },
    "orders": {
        "mappings": {
            "properties": {
                "order_id":       {"type": "keyword"},
                "customer_name":  {"type": "keyword"},
                "customer_email": {"type": "keyword"},
                "product_name":   {"type": "text"},
                "category":       {"type": "keyword"},
                "quantity":       {"type": "integer"},
                "total_price":    {"type": "integer"},
                "status":         {"type": "keyword"},
                "city":           {"type": "keyword"},
                "ordered_at":     {"type": "date"},
            }
        }
    },
}


def delete_index(name):
    try:
        _req("DELETE", f"/{name}")
        print(f"  [삭제] {name}")
    except urllib.error.HTTPError as e:
        if e.code != 404:
            raise


def create_index(name):
    _req("PUT", f"/{name}", MAPPINGS[name])
    print(f"  [생성] {name} (명시적 매핑)")


def bulk_index(index, docs):
    lines = []
    for i, doc in enumerate(docs):
        lines.append(json.dumps({"index": {"_index": index, "_id": str(i + 1)}}))
        lines.append(json.dumps(doc, ensure_ascii=False))
    payload = "\n".join(lines) + "\n"
    data = payload.encode("utf-8")
    headers = {"Content-Type": "application/x-ndjson"}
    req = urllib.request.Request(BASE_URL + "/_bulk", data=data, headers=headers, method="POST")
    with urllib.request.urlopen(req) as r:
        resp = json.loads(r.read())
    errors = [i for i in resp.get("items", []) if "error" in i.get("index", {})]
    if errors:
        print(f"  [경고] bulk 오류 {len(errors)}건")
    print(f"  [완료] {index}: {len(docs)}건 색인")


# ── 데이터 생성 함수 ────────────────────────────────────────────────

def make_products(n=200):
    docs = []
    for i in range(n):
        cat = random.choice(PRODUCT_CATEGORIES)
        names = PRODUCT_NAMES[cat]
        price = random.randint(1, 200) * 1000 + random.choice([0, 500, 900])
        docs.append({
            "name":        random.choice(names) + f" {random.choice(['Pro', 'Plus', 'Lite', 'Max', ''])}".strip(),
            "brand":       random.choice(BRANDS),
            "category":    cat,
            "price":       price,
            "stock":       random.randint(0, 500),
            "rating":      round(random.uniform(3.0, 5.0), 1),
            "is_active":   random.random() > 0.1,
            "description": f"{cat} 분야의 인기 상품입니다. 품질과 가성비를 모두 갖췄습니다.",
            "created_at":  rand_date(730),
        })
    return docs


def make_users(n=100):
    docs = []
    for i in range(n):
        name = rand_name()
        city = random.choice(CITIES)
        domain = random.choice(EMAIL_DOMAINS)
        total_orders = random.randint(0, 50)
        total_spent = total_orders * random.randint(10000, 150000)
        docs.append({
            "user_id":     f"USR-{i+1:05d}",
            "name":        name,
            "email":       f"{name}_{random.randint(10,99)}@{domain}",
            "age":         random.randint(18, 65),
            "city":        city,
            "grade":       random.choice(USER_GRADES),
            "is_active":   random.random() > 0.15,
            "joined_at":   rand_date(730),
            "total_orders": total_orders,
            "total_spent": total_spent,
        })
    return docs


def make_orders(n=200):
    docs = []
    for i in range(n):
        cat = random.choice(PRODUCT_CATEGORIES)
        names = PRODUCT_NAMES[cat]
        name = rand_name()
        domain = random.choice(EMAIL_DOMAINS)
        qty = random.randint(1, 5)
        unit_price = random.randint(1, 200) * 1000
        docs.append({
            "order_id":       f"ORD-2024-{i+1:05d}",
            "customer_name":  name,
            "customer_email": f"{name}_{random.randint(10,99)}@{domain}",
            "product_name":   random.choice(names),
            "category":       cat,
            "quantity":       qty,
            "total_price":    unit_price * qty,
            "status":         random.choice(ORDER_STATUSES),
            "city":           random.choice(CITIES),
            "ordered_at":     rand_date(180),
        })
    return docs


# ── 메인 ────────────────────────────────────────────────────────────

def main():
    print("=== OpenSearch 샘플 데이터 시드 ===\n")

    for idx in ["products", "users", "orders"]:
        delete_index(idx)
        create_index(idx)

    print("\n[products 200건]")
    bulk_index("products", make_products(200))

    print("\n[users 100건]")
    bulk_index("users", make_users(100))

    print("\n[orders 200건]")
    bulk_index("orders", make_orders(200))

    print("\n✅ 완료: 총 500건 색인")

    # 색인 반영 대기
    _req("POST", "/_all/_refresh")


if __name__ == "__main__":
    main()
